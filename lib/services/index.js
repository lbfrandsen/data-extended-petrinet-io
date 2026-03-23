import IdCounterService from './IdCounterService.js';
import MathService from './MathService.js';

export default {
  __init__: ['idCounterService', 'mathService'],
  idCounterService: ['type', IdCounterService],
  mathService: ['type', MathService]
};

