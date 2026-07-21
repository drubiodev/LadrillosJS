// Consuming a shared design system is two imports:
//  1. the tokens (plain CSS custom properties on :root)
//  2. the register function, called once at startup
import "my-design-system/tokens.css";
import { defineDesignSystem } from "my-design-system";

defineDesignSystem();
