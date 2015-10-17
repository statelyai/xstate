
import Machine from './lib/machine';

export default function machine(data) {
  return new Machine(data, {
    deterministic: true
  });
}