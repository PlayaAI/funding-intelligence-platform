import { Link } from "wouter";
import { site } from "@/data/site";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">P</span>
              </div>
              <span className="font-semibold text-sm">{site.orgName}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {site.missionShort}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Work</p>
            <ul className="space-y-2">
              <li><Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Projects</Link></li>
              <li><Link href="/workshops" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Workshops</Link></li>
              <li><Link href="/proof" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Proof</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Organization</p>
            <ul className="space-y-2">
              <li><Link href="/team" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Team</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{site.location} &middot; {site.email}</p>
          <p className="text-xs text-muted-foreground/60 border border-border rounded px-2 py-0.5">Public proof site - private workspace data stays internal</p>
        </div>
      </div>
    </footer>
  );
}
