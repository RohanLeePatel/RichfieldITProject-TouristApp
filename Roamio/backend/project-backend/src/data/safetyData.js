// Static fallbacks: emergency numbers by ISO alpha-3 code, and mock advisories used when
// SAFETY_SYNC_MODE=mock or no TRAVEL_RISK_API_KEY is configured.

const EMERGENCY_NUMBERS = {
  ZAF: { police: '10111', medical: '10177' },
  USA: { police: '911', medical: '911' },
  GBR: { police: '999', medical: '999' },
  FRA: { police: '17', medical: '15' },
  DEU: { police: '110', medical: '112' },
  ESP: { police: '091', medical: '061' },
  ITA: { police: '112', medical: '118' },
  AUS: { police: '000', medical: '000' },
  JPN: { police: '110', medical: '119' },
  THA: { police: '191', medical: '1669' },
  BRA: { police: '190', medical: '192' },
  MEX: { police: '911', medical: '911' },
  EGY: { police: '122', medical: '123' },
  KEN: { police: '999', medical: '999' }
};

const DEFAULT_EMERGENCY_NUMBER = '112';

const MOCK_ADVISORIES = {
  ZAF: { level: 3, score: 3, alerts: 2, text: 'Reconsider travel due to crime and civil unrest in some areas.' },
  FRA: { level: 2, score: 2, alerts: 1, text: 'Exercise increased caution due to terrorism and civil unrest.' },
  USA: { level: 1, score: 1, alerts: 0, text: 'Exercise normal precautions.' },
  EGY: { level: 3, score: 4, alerts: 3, text: 'Reconsider travel due to terrorism.' },
  MEX: { level: 3, score: 3, alerts: 2, text: 'Reconsider travel to several states due to crime and kidnapping.' }
};

module.exports = { EMERGENCY_NUMBERS, DEFAULT_EMERGENCY_NUMBER, MOCK_ADVISORIES };
