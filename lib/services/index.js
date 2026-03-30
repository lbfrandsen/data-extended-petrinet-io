import IdCounterService from './IdCounterService.js';
import MathService from './MathService.js';
import SqlDialogService from './SqlDialogService.js';
import DatabaseService from './DatabaseService.js';

export default {
  __init__: ['idCounterService', 'mathService', 'sqlDialogService', 'databaseService'],
  idCounterService: ['type', IdCounterService],
  mathService: ['type', MathService],
  sqlDialogService: ['type', SqlDialogService],
  databaseService: ['type', DatabaseService]
};
