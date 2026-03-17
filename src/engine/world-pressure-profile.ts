export function extractWorldBiases(description: string) {
  const normalized = description.toLowerCase()

  return {
    scarcityBias: /(scarce|shortage|ration|starvation)/.test(normalized) ? 1 : 0,
    statusRigidityBias: /(rigid|hierarchy|rank|caste|noble)/.test(normalized) ? 1 : 0,
    gatedAccessBias: /(gate|permit|controlled|guarded)/.test(normalized) ? 1 : 0,
    violenceLegitimacyBias: /(martial|violent|duel|might)/.test(normalized) ? 1 : 0,
    knowledgeControlBias: /(secret|forbidden|hidden|restricted)/.test(normalized) ? 1 : 0,
  }
}
