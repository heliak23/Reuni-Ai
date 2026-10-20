# 🚀 Reuni-Ai — Plataforma de Comunicação e Reuniões em Tempo Real

<p align="left">
  <img src="https://img.shields.io/badge/React-19.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/WebRTC-P2P-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/Deploy-Render.com-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render" />
</p>

O **Reuni-Ai** é uma aplicação completa e moderna para comunicação por texto, voz e vídeo, desenvolvida para execução 100% online no navegador (Web), focada em performance, design moderno e colaboração fluida.

---

## ✨ Funcionalidades Principais

### 📱 Design 100% Responsivo (Celular, Tablet e Desktop)
- **Menu Lateral Gaveta (Drawer Móvel):**
  - Em telas de celulares e tablets pequenos (`< 768px`), as barras de servidores e canais ficam recolhidas em uma gaveta lateral deslizante suave com fundo escurecido (*backdrop blur*).
  - Abertura com um toque no botão de menu hambúrguer `☰` no cabeçalho do chat ou da sala de voz.
  - Fechamento automático inteligente ao selecionar um canal de texto ou voz ou ao tocar fora.
- **Painel Lateral de Membros Adaptativo:**
  - Em computadores, fica fixo à direita.
  - Em celulares e tablets, abre como gaveta flutuante sobreposta com botão de fechar dedicado `✕`, garantindo espaço total para leitura e digitação de mensagens no chat.
- **Modais e Telas de Configurações Otimizados:**
  - O modal de **Configurações de Usuário** adapta-se com barra horizontal de abas no topo em celulares e altura dinâmica `h-[88vh]`.
  - Formulários de criação e desbloqueio de servidores centralizados e dimensionados para qualquer tamanho de tela (`max-w-md w-full`).

### 🎨 Interface e Experiência de Usuário
- **Temas Claro e Escuro:**
  - Suporte completo ao **Modo Claro** e ao **Modo Escuro**.
  - Alternância instantânea com pré-visualização em tempo real na aba de **Aparência** e persistência automática no navegador (`localStorage`).
- **Configurações Avançadas de Áudio (Microfone e Fone de Ouvido):**
  - **Detecção de múltiplos dispositivos:** Lista todos os microfones e fones/alto-falantes conectados na máquina do usuário via `enumerateDevices()`.
  - **Seleção de Dispositivo de Entrada e Saída:** Permite escolher qual microfone e qual fone utilizar.
  - **Ajuste de Volume:** Controles deslizantes independentes de volume de entrada e de saída.
  - **Teste de Microfone em Tempo Real:** Barra interativa com medidor de volume decibel ao vivo para testar a sensibilidade da voz antes de entrar nas salas.
- **Barra de Servidores e Comunidades:**
  - Botão inicial de Mensagens Diretas (Home).
  - Pílula lateral indicadora com animação suave de hover e seleção.
  - Tooltips suspensos informativos.
  - **Criação de Servidores com Senha Opcional:**
    - Opção de proteger o servidor com senha durante a criação para servidores privados/restritos.
    - Ícone de cadeado (`🔒`) visível no servidor e na etiqueta do tooltip.
    - Modal de desbloqueio com validação de senha antes de liberar o acesso aos canais e chat.
- **Barra Lateral de Canais:**
  - Categorias colapsáveis (`CANAIS DE TEXTO` e `CANAIS DE VOZ`).
  - Canais de texto (`#`) e voz (`🔊`) com status ativo e contadores.
  - Membros conectados em canais de voz exibidos diretamente na árvore de canais.
  - Barra de status de conexão de voz ativa (com indicador RTC e botão rápido para desconectar).
- **Barra de Perfil do Usuário (Rodapé):**
  - Avatar personalizável com indicador de status em tempo real (Online, Ausente, Ocupado).
  - Nome de usuário e tag identificadora (`#1024`).
  - Controles rápidos: Microfone (Silenciar), Fone (Desativar áudio) e Configurações de Perfil.
- **Área Central de Mensagens (Chat):**
  - Tópico do canal, barra de pesquisa, botão de fixados e sino de notificações.
  - Mensagens em tempo real com avatares, timestamps e markdown (`**negrito**`, links, etc.).
  - Reações dinâmicas com emojis (com contadores e alternância individual).
  - Indicador de digitação dinâmico (*"Fulano está digitando..."* com animação de pontos).
  - Barra de envio completa com atalho para emojis rápidos e botão de anexo.
- **Painel Lateral de Membros:**
  - Lista de usuários online e offline separados por categorias e cargos (incluindo bots).
- **Salas de Voz Interativas & Transmissão de Tela (Ao Vivo):**
  - **Modal de Transmissão:**
    - Escolha de Resolução: `720p HD` (Padrão) ou `1080p Full HD` (Pro).
    - Escolha de Taxa de Quadros: `30 FPS` ou `60 FPS`.
    - Título da transmissão customizável.
  - **Player de Transmissão Central (Stage):**
    - Tela ampla com captura real do navegador (`getDisplayMedia` para abas, janelas ou tela cheia).
    - Badge vermelho `[AO VIVO]` no topo do player e na lista de canais de voz.
    - Controles suspensos ao passar o mouse: Tela Cheia (Fullscreen), parar transmissão e badge de qualidade.
    - Faixa horizontal superior com os avatares dos participantes da sala.
  - **Detecção real de voz via microfone:** O avatar ganha uma borda verde pulsante automaticamente ao falar!
  - Suporte a ligar/desligar câmera de vídeo.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:**
  * [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
  * [Vite](https://vitejs.dev/)
  * [Tailwind CSS v4](https://tailwindcss.com/)
  * [Lucide React](https://lucide.dev/)
  * [Socket.io Client](https://socket.io/)
  * Web Audio API & WebRTC (detecção de microfone e voz em tempo real)

* **Backend:**
  * [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
  * [Socket.io](https://socket.io/) (Gateway em tempo real)
  * TypeScript

---

## 🚀 Como Executar o Projeto

### 1. Clonar e Instalar Dependências
```bash
# Na raiz do projeto:
npm install

# Instalar dependências do frontend e backend:
cd client && npm install
cd ../server && npm install
cd ..
```

### 2. Rodar em Modo de Desenvolvimento (Frontend + Backend)
Na raiz do projeto, execute:
```bash
npm run dev
```

* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **Backend WebSocket:** [http://localhost:3001](http://localhost:3001)

---

## ☁️ Deploy na Nuvem via Render.com (Tudo em 1 Único Serviço)

O **Reuni-Ai** já está 100% configurado para rodar em produção de forma unificada no **[Render.com](https://render.com)**:

1. Acesse o painel do [render.com](https://render.com) e clique em **"New +"** ➔ **"Web Service"**.
2. Conecte seu repositório do GitHub (`heliak23/Reuni-Ai`).
3. Configure os seguintes parâmetros na tela de criação:
   | Configuração | Valor Recomendado |
   | :--- | :--- |
   | **Name** | `reuni-ai` (ou o nome de sua preferência) |
   | **Language / Runtime** | `Node` |
   | **Branch** | `main` |
   | **Region** | `Ohio (US East)` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` ($0/mês) |
4. Na seção **Advanced**, deixe os campos padrão (não é necessário adicionar variáveis secretas).
5. Clique em **"Deploy Web Service"**.
6. O Render cuidará da compilação e deploy unificados, gerando um link público protegido por HTTPS (ex: `https://reuni-ai-xxxx.onrender.com`).

> [!NOTE]
> **HTTPS Obrigatório para Microfone & Tela:** O Render fornece certificado SSL automático gratuito. Isso garante que a API de captura do navegador (`getUserMedia` e `getDisplayMedia`) funcione sem restrições de segurança em qualquer computador ou celular.
>
> **Hibernação do Plano Free:** Instâncias gratuitas no Render entram em modo de hibernação após 15 minutos de inatividade. O primeiro acesso após hibernado pode levar cerca de ~40 segundos para inicializar o contêiner (*cold start*).
