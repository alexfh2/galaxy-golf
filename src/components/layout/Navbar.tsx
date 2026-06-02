import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import LanguageSwitcher from './LanguageSwitcher';
import logoGoldNavyV2 from '@/assets/galaxygolf-logo-gold-navy-v2.png.asset.json';
import logoOficial from '@/assets/galaxygolf-logo-oficial.png.asset.json';
// ThemeToggle removed — app locked to dark mode

const navItems = [
  { label: 'Circuito GalaxyGolf', path: '/circuito-galaxygolf' },
  { label: 'GalaxyCup', path: '/galaxycup' },
  { label: 'Calendario', path: '/jornades' },
  { label: 'Noticias', path: '/noticies' },
  { label: 'Jugadores', path: '/jugadors' },
] as const;

// Fallback tipográfico (se conserva por si el logo oficial no encaja en algún contexto)
const Wordmark = ({ className = '' }: { className?: string }) => (
  <span
    className={`font-display tracking-[0.22em] uppercase font-medium text-[hsl(var(--gg-gold))] ${className}`}
  >
    GALAXY GOLF
  </span>
);

// Logo monocromo dorado sobre navy v2 — fondo #041633, encaja con --gg-navbar-navy
const LogoGoldNavy = ({ className = '' }: { className?: string }) => (
  <img
    src={logoGoldNavyV2.url}
    alt="GalaxyGolf"
    className={`object-contain w-auto select-none ${className}`}
    draggable={false}
  />
);

// Logo oficial azul/verde — conservado como referencia / fallback opcional
const LogoOficial = ({ className = '' }: { className?: string }) => (
  <img
    src={logoOficial.url}
    alt="GalaxyGolf"
    className={`object-contain w-auto ${className}`}
    draggable={false}
  />
);

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isHome = location.pathname === '/';

  return (
    <header
      className={`${
        isHome ? 'absolute' : 'sticky'
      } top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isHome
          ? 'bg-transparent'
          : 'bg-[hsl(var(--gg-navbar-navy))] border-b border-[hsl(var(--gg-gold))]/15'
      }`}
    >
      <div className="container flex h-20 items-center justify-between py-4">
        <Link to="/" className="flex items-center" aria-label="GalaxyGolf — Inicio">
          <LogoGoldNavy className="h-8 sm:h-10 max-h-10" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={`${item.label}-${idx}`}
                to={item.path}
                className={`relative px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors ${
                  isActive
                    ? 'text-[hsl(var(--gg-gold))]'
                    : 'text-[hsl(var(--gg-ivory))]/70 hover:text-[hsl(var(--gg-gold))]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-px w-6 bg-[hsl(var(--gg-gold))]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {/* ThemeToggle hidden: app locked to dark mode */}
          <Link
            to="/admin"
            className="hidden sm:inline-flex items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] border border-[hsl(var(--gg-gold))]/60 text-[hsl(var(--gg-gold))] hover:bg-[hsl(var(--gg-gold))]/10 hover:border-[hsl(var(--gg-gold))] transition-colors"
          >
            Iniciar sesión
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className={isHome ? 'text-foreground/70 hover:text-foreground' : ''}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <SheetTitle>
                <Wordmark className="text-lg" />
              </SheetTitle>
              <nav className="mt-8 flex flex-col gap-0.5">
                {navItems.map((item, idx) => (
                  <Link
                    key={`m-${item.label}-${idx}`}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground/80 hover:text-[hsl(var(--gg-gold))] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="mt-4 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] border border-[hsl(var(--gg-copper))]/60 text-[hsl(var(--gg-copper))] text-center"
                >
                  Iniciar sesión
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
