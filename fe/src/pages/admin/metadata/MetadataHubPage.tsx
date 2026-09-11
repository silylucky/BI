import { useState } from "react";
import { BookOpen, FolderTree, Layers3 } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { ListPageSection } from "@/components/layout/list-page-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DimensionsPanel,
  GlossaryPanel,
  ThemesPanel,
} from "./metadata-panels";

export function MetadataHubPage() {
  const [tab, setTab] = useState("glossary");
  const [prefix, setPrefix] = useState("");

  return (
    <AdminPageShell
      title="语义层元数据"
      description="维护术语字典、业务主题树与维度字典，为数据集与报表提供统一语义口径。"
    >
      <ListPageSection>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-gray-100 px-5 pt-4 dark:border-white/[0.06]">
            <TabsList variant="enclosed" className="w-full sm:w-auto">
              <TabsTrigger value="glossary" variant="enclosed">
                术语字典
              </TabsTrigger>
              <TabsTrigger value="themes" variant="enclosed">
                业务主题
              </TabsTrigger>
              <TabsTrigger value="dimensions" variant="enclosed">
                维度字典
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="glossary" className="mt-0">
            <GlossaryPanel
              prefix={prefix}
              onPrefixChange={setPrefix}
              emptyIcon={<BookOpen className="size-7" aria-hidden />}
            />
          </TabsContent>

          <TabsContent value="themes" className="mt-0">
            <ThemesPanel emptyIcon={<FolderTree className="size-7" aria-hidden />} />
          </TabsContent>

          <TabsContent value="dimensions" className="mt-0">
            <DimensionsPanel
              prefix={prefix}
              onPrefixChange={setPrefix}
              emptyIcon={<Layers3 className="size-7" aria-hidden />}
            />
          </TabsContent>
        </Tabs>
      </ListPageSection>
    </AdminPageShell>
  );
}
