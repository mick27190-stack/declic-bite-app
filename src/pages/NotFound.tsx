import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Pizza } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Hero Gradient */}
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      
      <div className="relative z-10">
        {/* Pizza Icon */}
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-8 mx-auto">
          <Pizza className="w-12 h-12 text-primary animate-spin-slow" />
        </div>

        <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Page non trouvée
        </h2>
        <p className="text-muted-foreground mb-8 max-w-sm">
          Oups ! Cette page semble avoir été mangée... comme nos délicieuses pizzas ! 🍕
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="hero">
            <Link to="/">
              <Home className="w-5 h-5" />
              Retour à l'accueil
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/menu">
              <Pizza className="w-5 h-5" />
              Voir le menu
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
