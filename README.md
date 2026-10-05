# Orçamento Pessoal — iPhone

Versão para telemóvel do [Orçamento Pessoal](https://github.com/goncalomaiapinto/BudgetOS): a mesma app, mas sem servidor.
Corre toda no browser e **os dados ficam só no telemóvel** (IndexedDB do Safari). Este repositório tem apenas o código.

## Instalar no iPhone

1. Abrir o endereço da app no **Safari**.
2. Partilhar › **Adicionar ao ecrã principal**.
3. Abrir pelo ícone: funciona em ecrã inteiro e sem internet.

## Cópias de segurança

Os dados não estão em mais lado nenhum. Em **Definições › Cópia de segurança › Exportar cópia** guarda-se um ficheiro
`.json` (no iCloud Drive, Ficheiros, AirDrop…). Para recuperar, ou passar para outro telemóvel, **Restaurar cópia…**.

Importante: no iPhone, usa a app **sempre pelo ícone do ecrã principal**. Os dados do ícone e os do Safari normal
são guardados em sítios diferentes.

## Desenvolvimento

```
npm install
npm run dev
```

`src/lib/local-api.ts` é a API do PC (`src/Api/Endpoints` no repositório principal) passada para TypeScript: mesmas
rotas, regras e mensagens. O resto do frontend é igual ao da versão PC. Cada push para `main` publica no GitHub Pages
(`.github/workflows/pages.yml`).
