import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-[hsl(var(--gg-navy))] text-[hsl(var(--gg-ivory))]">
      <div className="border-b border-[hsl(var(--gg-gold))]/15">
        <div className="container py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="font-display text-2xl italic">
              Dos competiciones. Una misma pasión por el golf.
            </p>
            <p className="text-sm text-[hsl(var(--gg-ivory))]/60 mt-1">
              Sigue el Circuito GALAXY GOLF y la GalaxyCup durante toda la temporada 2026.
            </p>
          </div>
          <Link
            to="/jornades"
            className="flex items-center gap-2 px-6 py-3 border border-[hsl(var(--gg-gold))]/40 text-xs font-medium uppercase tracking-[0.2em] text-[hsl(var(--gg-gold))] hover:bg-[hsl(var(--gg-gold))]/10 transition-colors"
          >
            Consultar torneos
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-display tracking-[0.22em] uppercase text-[hsl(var(--gg-gold))] text-sm">
          GALAXY GOLF
        </span>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[hsl(var(--gg-ivory))]/50">
          GALAXY GOLF — Calendario y clasificaciones oficiales
        </p>
        <p className="text-[10px] text-[hsl(var(--gg-ivory))]/40">
          © {new Date().getFullYear()}
        </p>
      </div>
      <div className="container pb-4 flex justify-between items-center gap-4">
        <Link
          to="/bases-y-puntuaciones"
          className="text-[10px] tracking-[0.18em] uppercase text-[hsl(var(--gg-ivory))]/50 hover:text-[hsl(var(--gg-gold))] transition-colors"
        >
          Bases y puntuaciones
        </Link>
        <Link
          to="/admin"
          className="text-[10px] tracking-[0.18em] uppercase text-[hsl(var(--gg-ivory))]/30 hover:text-[hsl(var(--gg-ivory))]/60 transition-colors"
        >
          Admin
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
