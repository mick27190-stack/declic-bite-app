import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/print.css";
import { preloadHeroMedia } from "./lib/heroPreload";

// Précharge le visuel d'accueil avant le premier rendu React : sur mobile
// (iOS/Android) l'image est déjà téléchargée et décodée à l'affichage.
preloadHeroMedia();

createRoot(document.getElementById("root")!).render(<App />);

