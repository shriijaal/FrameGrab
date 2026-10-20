/**
 * The public engine surface FrameGrab uses, bundled as one IIFE.
 *
 * Every module is re-exported so the app can reach the whole engine from
 * `window.Asciify`: core (media), studio (art styles + export), field (GPU
 * character fields), hover (pointer effects) and kit (interface components).
 */
export * as core from 'asciify-engine/core';
export * as studio from 'asciify-engine/studio';
export * as field from 'asciify-engine/field';
export * as hover from 'asciify-engine/hover';
export * as kit from 'asciify-engine/kit';
