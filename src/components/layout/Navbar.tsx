import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import LanguageSwitcher from './LanguageSwitcher';
import logoGalaxyGolf from '@/assets/galaxygolf-logo.png.asset.json';
// ThemeToggle removed — app locked to dark mode

const navItems = [
  { label: 'Circuito GalaxyGolf', path: '/circuito-galaxygolf' },
  { label: 'GalaxyCup', path: '/galaxycup' },
  { label: 'Torneos', path: '/jornades' },
  { label: 'Estadísticas', path: '/estadistiques' },
  { label: 'Noticias', path: '/noticies' },
  { label: 'Jugadores', path: '/jugadors' },
] as const;

const Logo = ({ className = '' }: { className?: string }) => (
  <img
    src={logoGalaxyGolf.url}
    alt="GalaxyGolf"
    className={`object-contain w-auto select-none ${className}`}
    draggable={false}
  />
);

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[hsl(var(--gg-navbar-navy))] border-b border-[hsl(var(--gg-gold))]/15 transition-colors duration-300">
      <div className="container flex h-20 items-center py-4">
        <Link to="/" className="flex items-center" aria-label="GalaxyGolf — Inicio">
          <Logo className="h-12 sm:h-14" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 ml-6">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={`${item.label}-${idx}`}
                to={item.path}
                className={`relative px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors ${
                  isActive
                    ? 'text-[hsl(var(--gg-gold))]'
                    : 'text-[hsl(var(--gg-ivory))]/80 hover:text-[hsl(var(--gg-gold))]'
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

        <div className="flex items-center gap-3 ml-auto">
          <LanguageSwitcher />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <SheetTitle>
                <Logo className="h-10" />
              </SheetTitle>
              <nav className="mt-8 flex flex-col gap-0.5">
                {navItems.map((item, idx) => (
                  <Link
                    key={`m-${item.label}-${idx}`}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground/85 hover:text-[hsl(var(--gg-gold))] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
