/**
 * Example Component
 * 
 * A custom HTML element demonstrating dataroom-js features and web worker integration.
 * Creates a simple UI with heading, description, link, and displays web worker responses.
 */

import DataroomElement from 'dataroom-js';

/**
 * ExampleComponent class
 * 
 * Custom element that extends DataroomElement to demonstrate:
 * - Creating HTML elements with the create() method
 * - Web worker instantiation and communication
 * - Dynamic content rendering from worker responses
 * 
 * @extends DataroomElement
 */
class ExampleComponent extends DataroomElement {
  /**
   * Initialize the component
   * 
   * Creates the component's UI elements and sets up web worker communication.
   * Renders a heading, description paragraph, link to dataroom.js documentation,
   * and initiates communication with a web worker.
   * 
   * @async
   * @returns {Promise<void>}
   */
  async initialize(){
    this.create("h1", {content: "Example Code"});
    const p = this.create("p", {content: "This element uses the dataroom.js. It provides a few features that make using custom HTML Elements easier!"})
    this.create("a", {
      content: "Check it out here!", 
      href:"https://dataroom-network.github.io/dataroom.js/"}
    );
    
    // Initialize web worker
    const worker = new Worker(new URL('./example-webworker.js', import.meta.url));

    /**
     * Handle messages from the web worker
     * 
     * @param {MessageEvent} event - Message event from worker
     * @param {Object} event.data - Data received from worker
     */
    worker.onmessage = (event) => {
      console.log("Message received from worker:", event.data);
      this.create("p", {content: JSON.stringify(event.data)});

      // Emits a dataroom event
      this.event("WEB-WORKER-RESPONSE", event.data);
    };

    // Send initial message to worker
    worker.postMessage({ message: "Hello from the main thread!" });
  }
}

// Register the custom element
if (!customElements.get('example-component')) {
  customElements.define('example-component', ExampleComponent);
}
