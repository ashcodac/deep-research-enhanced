import { useState } from "react";
import { streamText, smoothStream } from "ai";
import { parsePartialJson } from "@ai-sdk/ui-utils";
import { openai } from "@ai-sdk/openai";
import { useTranslation } from "react-i18next";
import Plimit from "p-limit";
import { toast } from "sonner";
import useModelProvider from "@/hooks/useAiProvider";
import useWebSearch from "@/hooks/useWebSearch";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useSettingStore } from "@/store/setting";
import { useChunksStore } from "@/store/chunksStore";
import { useMemoryStore } from "@/store/memoryStore"; // 🚀 Import memory store
import {
  getSystemPrompt,
  getOutputGuidelinesPrompt,
  generateQuestionsPrompt,
  generateSerpQueriesPrompt,
  processResultPrompt,
  processSearchResultPrompt,
  reviewSerpQueriesPrompt,
  writeFinalReportPrompt,
  getSERPQuerySchema,
} from "@/utils/deep-research";
import { findClosestChunks } from "@/lib/ai";
import { isNetworkingModel } from "@/utils/model";
import { parseError } from "@/utils/error";
import { pick, flat } from "radash";

function getResponseLanguagePrompt(lang: string) {
  return `**Respond in ${lang}**`;
}

function removeJsonMarkdown(text: string) {
  text = text.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("json")) {
    text = text.slice(4);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

function smoothTextStream() {
  return smoothStream({
    chunking: "word",
    delayInMs: 0,
  });
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useDeepResearch() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { createProvider, getModel } = useModelProvider();
  const { tavily, firecrawl, exa, bocha, searxng } = useWebSearch();
  const [status, setStatus] = useState<string>("");

  async function askQuestions() {
    const { language } = useSettingStore.getState();
    const { question } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    const { chunks } = useChunksStore.getState();
    const { memories, addMemory } = useMemoryStore.getState(); // 🚀 Memory store
    setStatus(t("research.common.thinking"));

    let memoryContext = "";

    // 🚀 Step 1: Attach last few conversations
    if (memories.length > 0) {
      const recentMemories = memories.slice(-5); // Take last 5 (or less)
      memoryContext += recentMemories
        .map(
          (m) =>
            `Previous Q: ${m.question}\nPrevious A: ${m.answer}`
        )
        .join("\n\n") + "\n\n";
    }

    // 🚀 Step 2: Attach knowledge base matching chunks
    if (chunks.length > 0) {
      const relevantChunks = findClosestChunks(question, chunks);
      memoryContext += relevantChunks
        .map(
          (c) =>
            `From ${c.fileName}:\n${c.chunkText}`
        )
        .join("\n\n") + "\n\n";
    }

    const result = streamText({
      model: createProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        memoryContext.length > 0 ? `Context:\n\n${memoryContext}` : "",
        generateQuestionsPrompt(question),
        getResponseLanguagePrompt(language),
      ].join("\n\n"),
      experimental_transform: smoothTextStream(),
      onError: handleError,
    });

    let content = "";
    taskStore.setQuestion(question);

    for await (const textPart of result.textStream) {
      content += textPart;
      taskStore.updateQuestions(content);
    }

    // 🚀 Step 3: Save current question + answer into memory
    addMemory({ question, answer: content });
  }

  async function runSearchTask(queries: SearchTask[]) {
    const {
      provider,
      enableSearch,
      searchProvider,
      parallelSearch,
      searchMaxResult,
      language,
    } = useSettingStore.getState();
    const { networkingModel } = getModel();
    setStatus(t("research.common.research"));
    const plimit = Plimit(parallelSearch);
    const createModel = (model: string) => {
      // Enable Gemini's built-in search tool
      if (
        enableSearch &&
        searchProvider === "model" &&
        provider === "google" &&
        isNetworkingModel(model)
      ) {
        return createProvider(model, { useSearchGrounding: true });
      } else {
        return createProvider(model);
      }
    };
    const getTools = (model: string) => {
      // Enable OpenAI's built-in search tool
      if (
        enableSearch &&
        searchProvider === "model" &&
        provider === "openai" &&
        model.startsWith("gpt-4o")
      ) {
        return {
          web_search_preview: openai.tools.webSearchPreview({
            // optional configuration:
            searchContextSize: "medium",
          }),
        };
      } else {
        return undefined;
      }
    };
    const getProviderOptions = () => {
      // Enable OpenRouter's built-in search tool
      if (
        enableSearch &&
        searchProvider === "model" &&
        provider === "openrouter"
      ) {
        return {
          openrouter: {
            plugins: [
              {
                id: "web",
                max_results: searchMaxResult, // Defaults to 5
              },
            ],
          },
        };
      } else {
        return undefined;
      }
    };
    await Promise.all(
      queries.map((item) => {
        plimit(async () => {
          let content = "";
          let searchResult;
          let sources: Source[] = [];
          taskStore.updateTask(item.query, { state: "processing" });
          if (enableSearch) {
            if (searchProvider !== "model") {
              try {
                if (searchProvider === "tavily") {
                  sources = await tavily(item.query);
                } else if (searchProvider === "firecrawl") {
                  sources = await firecrawl(item.query);
                } else if (searchProvider === "exa") {
                  sources = await exa(item.query);
                } else if (searchProvider === "bocha") {
                  sources = await bocha(item.query);
                } else if (searchProvider === "searxng") {
                  sources = await searxng(item.query);
                }
              } catch (err) {
                console.error(err);
                handleError(`[${searchProvider}]: Search failed`);
                return plimit.clearQueue();
              }
              searchResult = streamText({
                model: createModel(networkingModel),
                system: getSystemPrompt(),
                prompt: [
                  processSearchResultPrompt(
                    item.query,
                    item.researchGoal,
                    sources
                  ),
                  getResponseLanguagePrompt(language),
                ].join("\n\n"),
                experimental_transform: smoothTextStream(),
                onError: handleError,
              });
            } else {
              searchResult = streamText({
                model: createModel(networkingModel),
                system: getSystemPrompt(),
                prompt: [
                  processResultPrompt(item.query, item.researchGoal),
                  getResponseLanguagePrompt(language),
                ].join("\n\n"),
                tools: getTools(networkingModel),
                providerOptions: getProviderOptions(),
                experimental_transform: smoothStream(),
                onError: handleError,
              });
            }
          } else {
            searchResult = streamText({
              model: createProvider(networkingModel),
              system: getSystemPrompt(),
              prompt: [
                processResultPrompt(item.query, item.researchGoal),
                getResponseLanguagePrompt(language),
              ].join("\n\n"),
              experimental_transform: smoothTextStream(),
              onError: handleError,
            });
          }
          for await (const part of searchResult.fullStream) {
            if (part.type === "text-delta") {
              content += part.textDelta;
              taskStore.updateTask(item.query, { learning: content });
            } else if (part.type === "reasoning") {
              console.log("reasoning", part.textDelta);
            } else if (part.type === "source") {
              sources.push(part.source);
            }
          }
          taskStore.updateTask(item.query, { state: "completed", sources });
          return content;
        });
      })
    );
  }

  async function reviewSearchResult() {
    const { language } = useSettingStore.getState();
    const { query, tasks, suggestion } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.research"));
    const learnings = tasks.map((item) => item.learning);
    const result = streamText({
      model: createProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        reviewSerpQueriesPrompt(query, learnings, suggestion),
        getResponseLanguagePrompt(language),
      ].join("\n\n"),
      experimental_transform: smoothTextStream(),
      onError: handleError,
    });

    const querySchema = getSERPQuerySchema();
    let content = "";
    let queries = [];
    for await (const textPart of result.textStream) {
      content += textPart;
      const data: PartialJson = parsePartialJson(removeJsonMarkdown(content));
      if (
        querySchema.safeParse(data.value) &&
        data.state === "successful-parse"
      ) {
        if (data.value) {
          queries = data.value.map(
            (item: { query: string; researchGoal: string }) => ({
              state: "unprocessed",
              learning: "",
              ...pick(item, ["query", "researchGoal"]),
            })
          );
        }
      }
    }
    if (queries.length > 0) {
      taskStore.update([...tasks, ...queries]);
      await runSearchTask(queries);
    }
  }

  async function writeFinalReport() {
    const { language } = useSettingStore.getState();
    const { query, tasks, setId, setTitle, setSources, requirement } =
      useTaskStore.getState();
    const { save } = useHistoryStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.writing"));
    const learnings = tasks.map((item) => item.learning);
    const result = streamText({
      model: createProvider(thinkingModel),
      system: [getSystemPrompt(), getOutputGuidelinesPrompt()].join("\n\n"),
      prompt: [
        writeFinalReportPrompt(query, learnings, requirement),
        getResponseLanguagePrompt(language),
      ].join("\n\n"),
      experimental_transform: smoothTextStream(),
      onError: handleError,
    });
    let content = "";
    for await (const textPart of result.textStream) {
      content += textPart;
      taskStore.updateFinalReport(content);
    }
    const title = content
      .split("\n\n")[0]
      .replaceAll("#", "")
      .replaceAll("**", "")
      .trim();
    setTitle(title);
    const sources = flat(
      tasks.map((item) => (item.sources ? item.sources : []))
    );
    setSources(sources);
    const id = save(taskStore.backup());
    setId(id);
    return content;
  }

  async function deepResearch() {
    const { language } = useSettingStore.getState();
    const { query } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    try {
      let queries = [];
      const result = streamText({
        model: createProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          generateSerpQueriesPrompt(query),
          getResponseLanguagePrompt(language),
        ].join("\n\n"),
        experimental_transform: smoothTextStream(),
        onError: handleError,
      });

      const querySchema = getSERPQuerySchema();
      let content = "";
      for await (const textPart of result.textStream) {
        content += textPart;
        const data: PartialJson = parsePartialJson(removeJsonMarkdown(content));
        if (querySchema.safeParse(data.value)) {
          if (
            data.state === "repaired-parse" ||
            data.state === "successful-parse"
          ) {
            if (data.value) {
              queries = data.value.map(
                (item: { query: string; researchGoal: string }) => ({
                  state: "unprocessed",
                  learning: "",
                  ...pick(item, ["query", "researchGoal"]),
                })
              );
              taskStore.update(queries);
            }
          }
        }
      }
      await runSearchTask(queries);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    status,
    deepResearch,
    askQuestions,
    runSearchTask,
    reviewSearchResult,
    writeFinalReport,
  };
}

export default useDeepResearch;