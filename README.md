# My Pokemon Deck

Personal Pokemon collection web app built with Express.js.
It supports two data providers:

- Pokemon TCG API (`api`)
- Local GitHub dataset from `PokemonTCG/pokemon-tcg-data` (`github`)

## Features

- Search Pokemon cards by name
- Sort by name, HP, newest set, or oldest set
- Filter cards by pack/set
- See which pack each card came from
- Open interactive virtual booster gacha packs by set
- Draw a cut line to open booster wrappers, then reveal cards back-first and flip front
- Uses `cardback.jpg` for card backs and PokeSymbols booster pack artwork when available
- Track your personal virtual binder with quantity, condition, and notes
- Persist binder data in browser localStorage

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment config:

   ```bash
   copy .env.example .env
   ```

3. Clone the dataset for reliable local testing:

   ```bash
   git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git data/pokemon-tcg-data
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`

## Data Source Mode

- `POKEMON_DATA_SOURCE=auto` (default): use GitHub local dataset when present, otherwise API
- `POKEMON_DATA_SOURCE=github`: always use local GitHub dataset
- `POKEMON_DATA_SOURCE=api`: always use live API

If you move the dataset folder, set `POKEMON_GITHUB_DATA_DIR`.

## API Key

This project reads the Pokemon TCG API key from `POKEMON_TCG_API_KEY`.
