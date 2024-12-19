class AudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0];
      if (inputChannel.length > 0) {
        this.port.postMessage({
          samples: inputChannel,
        });
      }
    }
    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
