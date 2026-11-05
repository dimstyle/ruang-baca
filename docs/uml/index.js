import mermaid from 'mermaid';

// Initialize Mermaid globally for this package instance
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose'
});

/**
 * Renders a requirement diagram string directly into a DOM element.
 * @param {string} elementId - A unique DOM string ID for the engine.
 * @param {string} code - The Mermaid syntax string.
 * @param {HTMLElement} targetElement - The actual DOM container where the SVG will live.
 */
export async function renderRequirementDiagram(elementId, code, targetElement) {
  try {
    // Basic validation to prevent runtime syntax breakage
    if (!code.trim().startsWith('requirementDiagram')) {
      throw new Error("Invalid diagram code. Must start with 'requirementDiagram'.");
    }

    const { svg } = await mermaid.render(elementId, code);
    targetElement.innerHTML = svg;
  } catch (error) {
    console.error("[@my-workspace/diagrams] Render failed:", error);
    targetElement.innerHTML = `<div style="color: red; border: 1px solid red; padding: 1rem;">
      <strong>Diagram Render Error:</strong> ${error.message}
    </div>`;
  }
}