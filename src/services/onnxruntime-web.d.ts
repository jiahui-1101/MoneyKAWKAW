// The locked BERT-compatible ORT prerelease omits types from its exports map.
// Its bundled declarations re-export this same version of onnxruntime-common.
declare module 'onnxruntime-web' {
  export * from 'onnxruntime-common';
}
