import IdCounterService from './IdCounterService.js';
import MathService from './MathService.js';
import SqlDialogService from './SqlDialogService.js';
import DatabaseService from './DatabaseService.js';
import SqlParserService from './SqlParserService.js';

export default {
  __init__: ['idCounterService', 'mathService', 'sqlDialogService', 'databaseService', 'sqlParserService'],
  idCounterService: ['type', IdCounterService],
  mathService: ['type', MathService],
  sqlDialogService: ['type', SqlDialogService],
  databaseService: ['type', DatabaseService],
  sqlParserService: ['type', SqlParserService]
};
