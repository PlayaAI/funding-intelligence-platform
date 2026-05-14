import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Mail, MapPin, ChevronDown } from "lucide-react";
import PageHeader from "@/components/public/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { site } from "@/data/site";

const interestTypes = [
  { value: "funding", label: "Funding / Grant discussion" },
  { value: "partnership", label: "Partnership" },
  { value: "workshop", label: "Workshop collaboration" },
  { value: "project", label: "Project collaboration" },
  { value: "media", label: "Media / Press" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  organization: z.string().optional(),
  interest: z.string().min(1, "Please select an interest type"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});

type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-colors";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (_data: FormData) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast({
      title: "Message sent",
      description: "Thank you for reaching out. We'll be in touch within a few business days.",
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div>
        <PageHeader label="Contact" title="Get in touch" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-lg mx-auto bg-card border border-border rounded-xl p-10 text-center" data-testid="contact-success">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Message received</h2>
            <p className="text-muted-foreground leading-relaxed">
              Thank you for reaching out. We'll get back to you within a few business days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        label="Contact"
        title="Get in touch"
        subtitle="We welcome conversations with funders, partners, workshop collaborators, community members, and press."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" data-testid="contact-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="name">
                    Name <span className="text-destructive font-normal">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    {...register("name")}
                    className={inputClass}
                    data-testid="contact-name"
                  />
                  {errors.name && (
                    <p className="mt-1.5 text-xs text-destructive font-medium">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="email">
                    Email <span className="text-destructive font-normal">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    className={inputClass}
                    data-testid="contact-email"
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-destructive font-medium">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="organization">
                  Organization <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <input
                  id="organization"
                  type="text"
                  placeholder="Foundation, company, or organization name"
                  {...register("organization")}
                  className={inputClass}
                  data-testid="contact-organization"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="interest">
                  Interest type <span className="text-destructive font-normal">*</span>
                </label>
                <div className="relative">
                  <select
                    id="interest"
                    {...register("interest")}
                    className={`${inputClass} appearance-none pr-10`}
                    data-testid="contact-interest"
                  >
                    <option value="">Select an interest type</option>
                    {interestTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.interest && (
                  <p className="mt-1.5 text-xs text-destructive font-medium">{errors.interest.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="message">
                  Message <span className="text-destructive font-normal">*</span>
                </label>
                <textarea
                  id="message"
                  rows={6}
                  placeholder="Tell us what you're interested in — a specific project, a funding conversation, a workshop collaboration, or anything else..."
                  {...register("message")}
                  className={`${inputClass} resize-none`}
                  data-testid="contact-message"
                />
                {errors.message && (
                  <p className="mt-1.5 text-xs text-destructive font-medium">{errors.message.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                data-testid="contact-submit"
              >
                {isSubmitting ? "Sending..." : "Send message"}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">Contact info</h3>
              <div className="space-y-3.5">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-0.5">Email</p>
                    <span>{site.email}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-0.5">Location</p>
                    <span>{site.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold text-foreground mb-4">What to mention</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Which project or area interests you",
                  "Your organization's focus or funding area",
                  "The kind of partnership or conversation you have in mind",
                  "Any relevant timeline or deadline",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We respond to all serious inquiries. If you're a funder or potential partner, feel free to ask for more documentation, project details, or a call. We'll make time for the right conversations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
