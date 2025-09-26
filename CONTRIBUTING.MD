# Contributing to InterviewAce 🚀

Thanks for checking the project.  I'm excited to have you contribute.
I've put together the following guidelines to help you figure out where you can best be helpful.

---

## Table of Contents

1. [Tech Stacks Used](#-tech-stack)
    - [Frontend](#frontend)
    - [AI & Computer Vision](#ai--computer-vision)
    - [Backend & Database](#backend--database)
    - [Data Processing](#data-processing)
    - [UI/UX](#uiux)
2. [Prerequisites](#️-prerequisites)
3. [Here's how to get started](#-how-to-get-started)
    - [Installation](#installation)
4. [Project Structure](#️-project-structure)
5. [Support](#-support)

---

## 📌 Tech Stack

### Frontend

- **React 18.3.1**: Modern React with hooks and functional components
- **TypeScript 5.5.3**: Type-safe development
- **Vite 5.4.2**: Fast build tool and development server
- **Tailwind CSS 3.4.1**: Utility-first CSS framework
- **React Router 6.20.1**: Client-side routing
- **React Hook Form 7.48.2**: Form management
- **Lucide React 0.344.0**: Beautiful icons

### AI & Computer Vision

- **Face-API.js 0.22.2**: Face detection and analysis
- **MediaPipe**: Advanced computer vision capabilities
- **OpenAI API**: GPT models for evaluation
- **Google Gemini API**: Alternative AI evaluation
- **Groq API**: Fast AI inference

### Backend & Database

- **Supabase 2.38.4**: Backend-as-a-Service with PostgreSQL
- **Real-time subscriptions**: Live data updates
- **Authentication**: Secure user management
- **File storage**: Document upload and management

### Data Processing

- **PDF.js 4.0.379**: PDF parsing and analysis
- **Mammoth 1.6.0**: DOCX file processing
- **PDF-parse 1.1.1**: PDF text extraction

### UI/UX

- **React Hot Toast 2.4.1**: Beautiful notifications
- **Chart.js 4.4.0**: Data visualization
- **React Chart.js 2 5.2.0**: React wrapper for Chart.js
- **Date-fns 2.30.0**: Date manipulation utilities

---

## ⏮️ Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Modern web browser with camera access (for face monitoring features)

---

## 🚀 How to Get Started

### Installation

1. **Fork this repository and Clone your forked repository**

   ```bash
   git clone <your-repo-url>
   cd Interview01
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Supabase Configuration & AI Provider API Keys
   >Create a `.env` file in the root directory:

    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

    VITE_OPENAI_API_KEY=your_openai_api_key
    VITE_GEMINI_API_KEY=your_gemini_api_key
    VITE_GROQ_API_KEY=your_groq_api_key
    ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**

    Navigate to `http://localhost:5173`

---

## 🏗️ Project Structure

```txt
src/
├── components/           # React components
│   ├── AITools/         # AI-powered tools
│   ├── Auth/            # Authentication components
│   ├── Dashboard/       # Main dashboard
│   ├── Evaluation/      # Evaluation results
│   ├── History/         # Practice history
│   ├── Home/            # Landing page
│   ├── JobTools/        # Job preparation tools
│   ├── Layout/          # Layout components
│   ├── Practice/        # Interview practice
│   ├── Profile/         # User profile
│   ├── Settings/        # App settings
│   └── StudyPlan/       # Study plan components
├── contexts/            # React contexts
├── data/               # Static data and questions
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── pages/              # Page components
├── services/           # API services
└── types/              # TypeScript type definitions
```

---

## 📞 Support

For support, [email us](mailto:support@interviewace.com) or join our [Slack channel](https://your-slack-channel-link).

---

Built with Om Singh❤️ for the developer community

*Transform your interview preparation with AI-powered coaching and real-time feedback.*
