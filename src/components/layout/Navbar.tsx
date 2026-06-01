import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { label: 'Rankings', path: '/ranquings' },
  { label: 'Torneos', path: '/jornades' },
  { label: 'Calendario', path: '/jornades' },
  { label: 'Noticias', path: '/noticies' },
  { label: 'Jugadores', path: '/jugadors' },
  { label: 'GalaxyCup', path: '/jornades' },
] as const;

const Wordmark = ({ className = '' }: { className?: string }) => (
  <span
    className={`font-display tracking-[0.22em] uppercase font-medium text-[hsl(var(--gg-gold))] ${className}`}
  >
    GALAXY GOLF
  </span>
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
          : 'bg-background/95 backdrop-blur border-b border-border/40'
      }`}
    >
      <div className="container flex h-18 items-center justify-between py-4">
        <Link to="/" className="flex items-center">
          <Wordmark className="text-xl sm:text-2xl" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={`${item.label}-${idx}`}
                to={item.path}
                className={`px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  isActive
                    ? 'text-[hsl(var(--gg-gold))]'
                    : 'text-foreground/70 hover:text-[hsl(var(--gg-gold))]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle isHome={isHome} />
          <Link
            to="/admin"
            className="hidden sm:inline-flex items-center px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] border border-[hsl(var(--gg-copper))]/60 text-[hsl(var(--gg-copper))] hover:bg-[hsl(var(--gg-copper))]/10 transition-colors"
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
