# 🚀 SafeTwin X5 - Instructions d'Installation

## Prérequis

- Node.js 20+ (https://nodejs.org)
- Git
- VS Code (recommandé)
- Compte Supabase (https://supabase.com)
- Compte Netlify (https://netlify.com)

---

## 📦 Installation Locale (VS Code)

### Étape 1: Cloner et copier les fichiers

```powershell
# Dans VS Code, ouvrez votre dossier projet
cd C:\Users\Mario\Documents\PROJECTS_NEW\SafeTwinX5

# Si le repo est déjà cloné, mettez à jour
git pull origin main

# Copiez tous les fichiers du ZIP dans ce dossier
# (gardez la structure existante)
```

### Étape 2: Installer les dépendances

```powershell
npm install
```

### Étape 3: Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hjrfrfzetpsxpuncswjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_SUPABASE_ICI
GEMINI_API_KEY=VOTRE_CLE_GEMINI_ICI
```

### Étape 4: Lancer le serveur de développement

```powershell
npm run dev
```

Ouvrez http://localhost:3000

---

## 🌐 Déploiement Netlify

### Méthode 1: Via GitHub (Recommandé)

1. **Push le code sur GitHub**
```powershell
git add .
git commit -m "Add SafeTwin X5 app code"
git push origin main
```

2. **Connecter à Netlify**
   - Allez sur https://app.netlify.com
   - Cliquez "Add new site" > "Import an existing project"
   - Sélectionnez GitHub > Preventera/SafeTwinX5
   
3. **Configurer le build**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Cliquez "Deploy site"

4. **Ajouter les variables d'environnement**
   - Site settings > Environment variables
   - Ajoutez:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `GEMINI_API_KEY`

5. **Installer le plugin Next.js**
   - Plugins > Add plugin
   - Cherchez `@netlify/plugin-nextjs`

### Méthode 2: Via Netlify CLI

```powershell
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Lier au site
netlify link

# Déployer
netlify deploy --prod
```

---

## 📁 Structure du Projet

```
SafeTwinX5/
├── app/                      # Pages Next.js (App Router)
│   ├── dashboard/           # Dashboard KPIs
│   ├── extractions/         # Liste et détail extractions
│   │   ├── [id]/           # Page détail
│   │   └── new/            # DocumentToTwin
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Redirect vers dashboard
├── components/
│   ├── dashboard/          # Composants dashboard
│   ├── extractions/        # Composants extractions
│   └── layout/             # Sidebar, Header
├── data/
│   ├── cnesst-stats.json   # Statistiques CNESST
│   └── scian-codes.json    # Codes SCIAN
├── lib/
│   ├── supabase.ts         # Client Supabase
│   ├── scian.ts            # Utilitaires SCIAN/CNESST
│   └── utils.ts            # Helpers
├── .env.example            # Variables d'environnement
├── netlify.toml            # Config Netlify
├── tailwind.config.ts      # Config Tailwind
└── package.json
```

---

## 🔧 Configuration Supabase

Votre base Supabase est déjà configurée avec la table `extractions`.

**URL:** https://hjrfrfzetpsxpuncswjs.supabase.co

Si vous devez recréer la table:

```sql
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source_document TEXT,
  document_type TEXT,
  status TEXT DEFAULT 'pending',
  extraction JSONB
);
```

---

## 🎯 Pages Disponibles

| Route | Description |
|-------|-------------|
| `/dashboard` | KPIs, stats, actions rapides |
| `/extractions` | Liste des documents analysés |
| `/extractions/new` | Nouvelle extraction (DocumentToTwin) |
| `/extractions/[id]` | Détail avec zones, dangers, benchmark CNESST |

---

## 🔑 Clés API

### Supabase
- Dashboard: https://supabase.com/dashboard/project/hjrfrfzetpsxpuncswjs
- Settings > API > anon key

### Gemini (optionnel)
- https://aistudio.google.com/apikey

---

## ❓ Dépannage

**Erreur "Module not found"**
```powershell
rm -rf node_modules
npm install
```

**Erreur Supabase "Invalid API key"**
- Vérifiez votre `.env.local`
- La clé doit être la `anon` key (public)

**Page blanche**
- Vérifiez la console du navigateur (F12)
- Vérifiez les logs: `npm run dev`

---

*SafeTwin X5 by Preventera / AgenticX5*
