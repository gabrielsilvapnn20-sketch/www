# ig-agent

Agente de teste que usa sua conta do Instagram como uma pessoa faria: assiste reels, rola o feed e curte alguns posts de vez em quando. Roda em um navegador **visível**, então dá pra acompanhar tudo ao vivo.

## Instalação (no seu computador)

```bash
npm install
npx playwright install chromium
```

## 1. Login (uma vez)

```bash
npm run login
```

Abre o navegador. Faça login normalmente (com 2FA, se tiver) e aperte ENTER no terminal. A sessão fica salva em `.ig-profile/`, e o código nunca vê sua senha.

## 2. Rodar

```bash
npm run dry
```
Modo teste: faz tudo, mas **não** clica em curtir (só registra onde curtiria).

```bash
npm start
```
Sessão real. Para escolher a duração: `node src/agent.js --minutes=5`. Para parar: Ctrl+C.

## O que ele faz

- Alterna blocos de 2–5 min entre **Reels** e **Feed**
- Reels: assiste 4–25 s cada (às vezes até o fim, 25–60 s), às vezes volta um
- Feed: scroll gradual, para 2–9 s em cada post, às vezes sobe um pouco ou fica parado
- Curte ~12% do que vê, com limite de 8 por sessão e 30 por dia
- Fecha pop-ups de "Agora não"

Tudo é ajustável em `src/config.js`. Cada sessão gera um log em `logs/` (JSONL) com o que foi visto e curtido.

## Aviso

Os termos do Instagram proíbem automação de contas. Mesmo com limites baixos, há risco de bloqueios temporários ou de pedirem verificação. Teste primeiro com `npm run dry` e com uma conta que você aceite arriscar.
