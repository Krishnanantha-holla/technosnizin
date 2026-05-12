import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-white">
      <div className="font-display text-[8rem] leading-none text-glow-white">404</div>
      <p className="mt-2 font-mono-ui text-sm text-white/50 tracking-widest">PAGE NOT FOUND</p>
      <Link
        to="/"
        className="mt-8 font-mono-ui text-xs tracking-wider text-keys hover:underline"
      >
        ← BACK TO SONIQ
      </Link>
    </main>
  );
};

export default NotFound;
