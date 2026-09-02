const disabledMessage = 'AI features are disabled in this public demo.';

function disabledFeature() {
  return Promise.reject(new Error(disabledMessage));
}

export const analyzeBPUFile = disabledFeature;
export const proposePlanningFromBPU = disabledFeature;
export const generateExecutiveSummary = disabledFeature;
export const askChatbot = disabledFeature;
export const proposePlanningAdjustment = disabledFeature;
