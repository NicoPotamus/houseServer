/**
 * This is a wrapper around the refactored WebRTCFileView component.
 * It maintains backward compatibility for existing imports.
 */
import Component, { WebRTCFileViewProps as Props } from './WebRTCFileView/index';

// Export the component as default
export default Component;

// Export component props type
export type WebRTCFileViewProps = Props;
