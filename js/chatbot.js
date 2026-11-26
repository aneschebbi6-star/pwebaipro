(() => {
    const root = document.createElement("div");
    root.innerHTML = `
        <button class="ai-chat-launcher" type="button" aria-expanded="false" aria-controls="ai-chat-panel">
            <span aria-hidden="true">✦</span> Poser une question
        </button>
        <section class="ai-chat-panel" id="ai-chat-panel" aria-label="Assistant IA" hidden>
            <header class="ai-chat-header">
                <div>
                    <h2>Assistant IA Futur</h2>
                    <p>Parlons de l’IA et de l’évolution des métiers.</p>
                </div>
                <button class="ai-chat-close" type="button" aria-label="Fermer le chat">×</button>
            </header>
            <div class="ai-chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
            <div class="ai-chat-quick-prompts" aria-label="Questions suggérées">
                <button type="button">Quels métiers l’IA transforme-t-elle ?</button>
                <button type="button">Quelles compétences apprendre ?</button>
                <button type="button">Quels métiers émergent ?</button>
            </div>
            <p class="ai-chat-status" aria-live="polite"></p>
            <form class="ai-chat-form">
                <textarea name="question" rows="1" maxlength="1200" placeholder="Écris ta question..." aria-label="Ta question" required></textarea>
                <button type="submit">Envoyer</button>
            </form>
            <div class="ai-chat-footer">
                Tes questions sont envoyées à Groq. N’envoie pas d’informations personnelles.
                <button class="ai-chat-clear" type="button">Effacer la conversation</button>
            </div>
        </section>`;
    document.body.append(root);

    const launcher = root.querySelector(".ai-chat-launcher");
    const panel = root.querySelector(".ai-chat-panel");
    const closeButton = root.querySelector(".ai-chat-close");
    const messagesElement = root.querySelector(".ai-chat-messages");
    const form = root.querySelector(".ai-chat-form");
    const input = form.elements.question;
    const submitButton = form.querySelector('button[type="submit"]');
    const status = root.querySelector(".ai-chat-status");
    const clearButton = root.querySelector(".ai-chat-clear");
    const promptButtons = [...root.querySelectorAll(".ai-chat-quick-prompts button")];
    const conversation = [];
    const allowedSourceHosts = new Set([
        "weforum.org",
        "ilo.org",
        "fda.gov",
        "github.blog",
        "nist.gov",
        "eur-lex.europa.eu"
    ]);

    function setOpen(open) {
        panel.hidden = !open;
        launcher.setAttribute("aria-expanded", String(open));
        if (open) input.focus();
        else launcher.focus();
    }

    function addMessage(role, text, isError) {
        const message = document.createElement("div");
        message.className = `ai-chat-message ai-chat-message--${role}${isError ? " ai-chat-message--error" : ""}`;
        if (role !== "assistant" || isError) {
            message.textContent = text;
        } else {
            appendAssistantText(message, text);
        }
        messagesElement.append(message);
        messagesElement.scrollTop = messagesElement.scrollHeight;
    }

    function appendAssistantText(container, text) {
        const urlPattern = /https:\/\/[^\s<>]+/g;
        let lastIndex = 0;
        let match;
        while ((match = urlPattern.exec(text)) !== null) {
            let urlText = match[0];
            let trailing = "";
            while (/[.,;:!?)]$/.test(urlText)) {
                trailing = urlText.slice(-1) + trailing;
                urlText = urlText.slice(0, -1);
            }
            container.append(document.createTextNode(text.slice(lastIndex, match.index)));
            try {
                const url = new URL(urlText);
                const allowed = [...allowedSourceHosts].some(host =>
                    url.hostname === host || url.hostname.endsWith(`.${host}`)
                );
                if (allowed) {
                    const link = document.createElement("a");
                    link.href = url.href;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = urlText;
                    container.append(link);
                } else {
                    container.append(document.createTextNode(urlText));
                }
            } catch {
                container.append(document.createTextNode(urlText));
            }
            container.append(document.createTextNode(trailing));
            lastIndex = match.index + match[0].length;
        }
        container.append(document.createTextNode(text.slice(lastIndex)));
    }

    async function sendQuestion(question) {
        const cleanQuestion = question.trim();
        if (!cleanQuestion || submitButton.disabled) return;

        setOpen(true);
        addMessage("user", cleanQuestion);
        conversation.push({ role: "user", content: cleanQuestion });
        if (conversation.length > 10) conversation.splice(0, conversation.length - 10);
        input.value = "";
        submitButton.disabled = true;
        promptButtons.forEach(button => { button.disabled = true; });
        status.textContent = "L’assistant prépare sa réponse…";

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: conversation })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Le service IA n’a pas pu répondre.");
            }
            if (typeof result.reply !== "string" || !result.reply.trim()) {
                throw new Error("Le service IA a renvoyé une réponse vide. Réessaie.");
            }
            conversation.push({ role: "assistant", content: result.reply });
            if (conversation.length > 10) conversation.splice(0, conversation.length - 10);
            addMessage("assistant", result.reply);
            status.textContent = "";
        } catch (error) {
            status.textContent = "";
            addMessage("assistant", error.message || "Impossible de joindre le service IA.", true);
        } finally {
            submitButton.disabled = false;
            promptButtons.forEach(button => { button.disabled = false; });
            input.focus();
        }
    }

    launcher.addEventListener("click", () => setOpen(panel.hidden));
    closeButton.addEventListener("click", () => setOpen(false));
    form.addEventListener("submit", event => {
        event.preventDefault();
        sendQuestion(input.value);
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    promptButtons.forEach(button => {
        button.addEventListener("click", () => sendQuestion(button.textContent));
    });
    clearButton.addEventListener("click", () => {
        conversation.length = 0;
        messagesElement.replaceChildren();
        status.textContent = "";
        input.value = "";
        addMessage("assistant", "Bonjour ! Je peux répondre à tes questions sur l’IA, les métiers et les compétences présentés sur ce site.");
        input.focus();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });

    addMessage("assistant", "Bonjour ! Je peux répondre à tes questions sur l’IA, les métiers et les compétences présentés sur ce site.");
})();
