
import Machine from './machine';

export default function machine(data) {
  return new Machine(data, {
    deterministic: false
  });
}