import { type Features } from "@services/features";
import { createContext } from "react";

export interface UseFeaturesProps {
  features: Features;
}

export const FeaturesContext = createContext<undefined | UseFeaturesProps>(
  undefined,
);
