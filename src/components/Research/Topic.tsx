"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle, SquarePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Internal/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import FileUpload from "@/components/FileUpload";
import OutputTemplateUpload from "@/components/OutputTemplateUpload"; // 🚀 NEW
import useDeepResearch from "@/hooks/useDeepResearch";
import useAccurateTimer from "@/hooks/useAccurateTimer";
import useAiProvider from "@/hooks/useAiProvider";
import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useUploadedFilesStore } from "@/store/uploadedFilesStore";

const formSchema = z.object({
  topic: z.string().min(2),
});

function Topic() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { askQuestions } = useDeepResearch();
  const { hasApiKey } = useAiProvider();
  const {
    formattedTime,
    start: accurateTimerStart,
    stop: accurateTimerStop,
  } = useAccurateTimer();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const { files } = useUploadedFilesStore();
  const [templateFiles, setTemplateFiles] = useState<File[]>([]); // 🚀

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: taskStore.question,
    },
  });

  useEffect(() => {
    form.setValue("topic", taskStore.question);
  }, [taskStore.question, form]);

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    const { mode } = useSettingStore.getState();
    if ((mode === "local" && hasApiKey()) || mode === "proxy") {
      const { id, setQuestion } = useTaskStore.getState();
      try {
        setIsThinking(true);
        accurateTimerStart();
        if (id !== "") {
          createNewResearch();
          form.setValue("topic", values.topic);
        }
        setQuestion(values.topic);
        await askQuestions(files); // Knowledge Base files
      } finally {
        setIsThinking(false);
        accurateTimerStop();
      }
    } else {
      const { setOpenSetting } = useGlobalStore.getState();
      setOpenSetting(true);
    }
  }

  function createNewResearch() {
    const { id, backup, reset } = useTaskStore.getState();
    const { update } = useHistoryStore.getState();
    if (id) update(id, backup());
    reset();
    form.reset();
    setTemplateFiles([]); // 🚀 Clear Template Uploads on New Research
  }

  return (
    <section className="p-4 border rounded-md mt-4 print:hidden">
      <div className="flex justify-between items-center border-b mb-2">
        <h3 className="font-semibold text-lg leading-10">
          {t("research.topic.title")}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={createNewResearch}
            title={t("research.common.newResearch")}
          >
            <SquarePlus />
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {/* Research Topic Input */}
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 font-semibold">
                  {t("research.topic.topicLabel")}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={t("research.topic.topicPlaceholder")}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Knowledge Base Upload */}
          <div className="mt-6">
            <FormLabel className="mb-2 font-semibold">
              Selected Knowledge Base (Optional)
            </FormLabel>
            <FileUpload />
          </div>

          {/* Output Template Upload */}
          <div className="mt-6">
            <FormLabel className="mb-2 font-semibold">
              Output Template (Optional)
            </FormLabel>
            <OutputTemplateUpload onFilesChange={(files) => setTemplateFiles(files)} />
          </div>

          {/* Submit Button */}
          <Button className="mt-6 w-full" disabled={isThinking} type="submit">
            {isThinking ? (
              <>
                <LoaderCircle className="animate-spin" />
                <span>{t("research.common.thinkingQuestion")}</span>
                <small className="font-mono">{formattedTime}</small>
              </>
            ) : (
              t("research.common.startThinking")
            )}
          </Button>
        </form>
      </Form>
    </section>
  );
}

export default Topic;
