/**
 * Example Web Worker
 * 
 * Simple web worker that receives messages from the main thread and responds.
 * Demonstrates basic worker communication pattern.
 */

/**
 * Message handler for incoming messages from main thread
 * 
 * Logs the received message and sends a response back to the main thread.
 * 
 * @param {MessageEvent} event - The message event from the main thread
 * @param {*} event.data - Data sent from the main thread
 */
self.onmessage = (event) => {
  console.log("Message received in worker:", event.data);
  self.postMessage({ message: "Hello from Web Worker!" });
};
