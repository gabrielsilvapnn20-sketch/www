// Ajuste aqui o comportamento do agente.
export default {
  // Duração total da sessão (minutos) — sorteado entre min e max.
  sessionMinutes: [8, 15],

  // Cada sessão alterna entre blocos de atividade. Peso de cada uma:
  activities: { reels: 0.6, feed: 0.4 },
  // Duração de cada bloco (minutos).
  blockMinutes: [2, 5],

  // Reels: quanto tempo "assistir" cada um (segundos).
  reelWatchSeconds: [4, 25],
  // Chance de assistir um reel até o fim (tempo maior).
  reelFullWatchChance: 0.25,
  reelFullWatchSeconds: [25, 60],

  // Feed: tempo parado olhando um post (segundos).
  feedDwellSeconds: [2, 9],

  // Curtidas
  likeProbability: 0.12,     // chance de curtir cada item visto
  maxLikesPerSession: 8,
  maxLikesPerDay: 30,

  // Navegador
  headless: false,          // mantenha false para acompanhar ao vivo
  userDataDir: './.ig-profile',
  locale: 'pt-BR',
  viewport: { width: 1280, height: 860 },
};
