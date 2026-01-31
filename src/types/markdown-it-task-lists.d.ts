declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  type TaskListOptions = {
    label?: boolean;
    labelAfter?: boolean;
  };

  const plugin: (md: MarkdownIt, options?: TaskListOptions) => void;
  export default plugin;
}
