import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ProjectRow } from "@/hooks/useProjects";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  category: z.string().optional(),
  stage: z.string().optional(),
  summary: z.string().optional(),
  problem_statement: z.string().optional(),
  solution: z.string().optional(),
  target_audience: z.string().optional(),
  geography: z.string().optional(),
  technology: z.string().optional(),
  impact: z.string().optional(),
  grant_relevance: z.string().optional(),
  reusable_grant_language: z.string().optional(),
  public_visibility: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export type ProjectFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  defaultValues?: Partial<ProjectRow>;
  title: string;
  submitLabel: string;
  loading: boolean;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function ProjectFormDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  title,
  submitLabel,
  loading,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      category: "",
      stage: "",
      summary: "",
      problem_statement: "",
      solution: "",
      target_audience: "",
      geography: "",
      technology: "",
      impact: "",
      grant_relevance: "",
      reusable_grant_language: "",
      public_visibility: false,
      featured: false,
    },
  });

  const nameValue = watch("name");

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name ?? "",
        slug: defaultValues.slug ?? "",
        category: defaultValues.category ?? "",
        stage: defaultValues.stage ?? "",
        summary: defaultValues.summary ?? "",
        problem_statement: defaultValues.problem_statement ?? "",
        solution: defaultValues.solution ?? "",
        target_audience: defaultValues.target_audience ?? "",
        geography: defaultValues.geography ?? "",
        technology: defaultValues.technology ?? "",
        impact: defaultValues.impact ?? "",
        grant_relevance: defaultValues.grant_relevance ?? "",
        reusable_grant_language: defaultValues.reusable_grant_language ?? "",
        public_visibility: defaultValues.public_visibility ?? false,
        featured: defaultValues.featured ?? false,
      });
    } else {
      reset();
    }
  }, [defaultValues, open, reset]);

  useEffect(() => {
    if (!defaultValues && nameValue) {
      setValue("slug", toSlug(nameValue), { shouldValidate: false });
    }
  }, [nameValue, defaultValues, setValue]);

  const handleFormSubmit = async (values: ProjectFormValues) => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">
                Project name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Connect App"
                className="h-8 text-sm"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-xs font-medium">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                {...register("slug")}
                placeholder="connect-app"
                className="h-8 text-sm font-mono"
              />
              {errors.slug && (
                <p className="text-xs text-red-500">{errors.slug.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-medium">
                Category
              </Label>
              <Input
                id="category"
                {...register("category")}
                placeholder="Human Connection Technology"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stage" className="text-xs font-medium">
                Stage
              </Label>
              <Input
                id="stage"
                {...register("stage")}
                placeholder="Active, Prototype, Live…"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary" className="text-xs font-medium">
              Summary
            </Label>
            <Textarea
              id="summary"
              {...register("summary")}
              placeholder="One-paragraph project summary."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="problem_statement" className="text-xs font-medium">
              Problem statement
            </Label>
            <Textarea
              id="problem_statement"
              {...register("problem_statement")}
              placeholder="What problem does this project address?"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="solution" className="text-xs font-medium">
              Solution
            </Label>
            <Textarea
              id="solution"
              {...register("solution")}
              placeholder="How does this project solve the problem?"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="target_audience" className="text-xs font-medium">
                Target audience
              </Label>
              <Textarea
                id="target_audience"
                {...register("target_audience")}
                placeholder="Who does this project serve?"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="geography" className="text-xs font-medium">
                Geography
              </Label>
              <Input
                id="geography"
                {...register("geography")}
                placeholder="Bay Area, Global, Online…"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="technology" className="text-xs font-medium">
              Technology
            </Label>
            <Input
              id="technology"
              {...register("technology")}
              placeholder="React Native, OpenAI, etc."
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="impact" className="text-xs font-medium">
              Impact
            </Label>
            <Textarea
              id="impact"
              {...register("impact")}
              placeholder="Documented outcomes and impact."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant_relevance" className="text-xs font-medium">
              Grant relevance
            </Label>
            <Input
              id="grant_relevance"
              {...register("grant_relevance")}
              placeholder="Social cohesion, humane technology, community building…"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reusable_grant_language" className="text-xs font-medium">
              Reusable grant language
            </Label>
            <Textarea
              id="reusable_grant_language"
              {...register("reusable_grant_language")}
              placeholder="Boilerplate project language for reuse in grant applications."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("public_visibility")}
                className="rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">Visible on public site</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("featured")}
                className="rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">Featured project</span>
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="text-xs">
              {loading ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
