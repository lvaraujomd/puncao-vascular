const { useState } = React;

const VASOS_POR_ACESSO = {
  cvc_jugular: ["Veia jugular interna direita", "Veia jugular interna esquerda"],
  cvc_subclavia: ["Veia subclávia direita", "Veia subclávia esquerda"],
  cvc_femoral: ["Veia femoral direita", "Veia femoral esquerda"],
  picc: ["Veia basílica direita", "Veia basílica esquerda", "Veia braquial direita", "Veia braquial esquerda", "Veia axilar direita", "Veia axilar esquerda", "Veia cefálica direita", "Veia cefálica esquerda", "Veia safena direita", "Veia safena esquerda", "Veia femoral direita", "Veia femoral esquerda"],
  arterial: ["Artéria radial direita", "Artéria radial esquerda", "Artéria braquial direita", "Artéria braquial esquerda", "Artéria axilar direita", "Artéria axilar esquerda", "Artéria femoral direita", "Artéria femoral esquerda"],
};
const CATETERES_POR_ACESSO = {
  cvc_jugular: ["Acesso venoso profundo duplo lúmen", "Acesso venoso profundo triplo lúmen", "Cateter de hemodiálise"],
  cvc_subclavia: ["Acesso venoso profundo duplo lúmen", "Acesso venoso profundo triplo lúmen", "Cateter de hemodiálise"],
  cvc_femoral: ["Acesso venoso profundo duplo lúmen", "Acesso venoso profundo triplo lúmen", "Cateter de hemodiálise"],
  picc: ["PICC Power triplo lúmen", "PICC Power duplo lúmen", "PICC Power mono lúmen"],
  arterial: ["Cateter arterial"],
};
const TIPOS_LABEL = {
  cvc_jugular: "CVC Jugular Interno",
  cvc_subclavia: "CVC Subclávia",
  cvc_femoral: "CVC Femoral",
  picc: "PICC",
  arterial: "Acesso Arterial",
};
const RX_OPTS = [
  "Realizado – cateter em posição adequada, sem pneumotórax ou hemotórax",
  "Realizado – cateter em posição adequada",
  "Pendente de realização",
  "Não indicado (acesso femoral/arterial)",
];
const COMP_OPTS = [
  "Nenhuma complicação imediata observada",
  "Hematoma local de pequena monta, sem repercussão hemodinâmica",
  "Punção arterial acidental – compressão realizada com hemostasia",
  "Outro",
];
const INITIAL = {
  tipo: "", vaso: "", cateter: "", calibre: "", comprimento: "",
  npuncoes: "1", fixacao: "", npt: "nao",
  flush: "nao", jugular: "nao", rx: "", complicacao: "", comp_outro: "",
};

const STORAGE_KEY = "puncao_registros";

function fmtDate(d) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function exportCSV(registros) {
  const cols = ["Data/Hora","Procedimento","Tipo","Vaso","Cateter","Calibre (Fr)","Comprimento (cm)","Nº Punções","Fixação","RX","Complicação"];
  const rows = [];
  registros.forEach(r => {
    r.procs.forEach((p, i) => {
      rows.push([
        fmtDate(r.ts), i === 0 ? "1º" : "2º",
        TIPOS_LABEL[p.tipo] || p.tipo, p.vaso, p.cateter, p.calibre, p.comprimento,
        p.npuncoes, p.fixacao === "pontos" ? "Pontos" : p.fixacao === "statlock" ? "Statlock" : "",
        p.rx, p.complicacao
      ]);
    });
  });
  const bom = "\uFEFF";
  const csv = bom + [cols, ...rows].map(r => r.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "puncoes_vasculares.csv";
  a.click(); URL.revokeObjectURL(url);
}

function buildPrompt(form) {
  const isArterial = form.tipo === "arterial";
  const comp = form.complicacao === "Outro" ? form.comp_outro : form.complicacao;
  const extras = [
    form.npt === "sim" ? "Uma via separada foi reservada para NPT." : "",
    form.flush === "sim" ? "Flush com solução fisiológica realizado com insonação do ventrículo direito, confirmando posicionamento adequado do cateter." : "",
    form.jugular === "sim" ? "Insonação da jugular ipsilateral realizada ao final, sem evidência de migração cefálica do cateter." : "",
  ].filter(Boolean).join(" ");
  if (isArterial) {
    return `Você é um médico intensivista brasileiro redigindo evolução de procedimento para prontuário. Português, linguagem médica formal, texto corrido, sem marcadores, sem cabeçalho, sem markdown. Máximo 3 linhas, um parágrafo.
Dados:
- Procedimento: Punção arterial / passagem de cateter arterial
- Vaso: ${form.vaso}
- Guia ecográfico: sim
${comp ? `- Complicações: ${comp}` : ""}
Inclua: antissepsia e campos estéreis (brevemente), vaso puncionado, uso de US, fixação com curativo oclusivo, funcionamento adequado da linha arterial. Complicações só se houver.`;
  }
  return `Você é um médico intensivista brasileiro redigindo evolução de procedimento para prontuário. Português, linguagem médica formal, texto corrido, sem marcadores, sem cabeçalho, sem markdown. Máximo 4 linhas, um parágrafo.
Dados:
- Procedimento: ${TIPOS_LABEL[form.tipo]}
- Vaso: ${form.vaso}
${form.cateter ? `- Cateter: ${form.cateter}` : ""}
${form.calibre ? `- Calibre: ${form.calibre} Fr` : ""}
${form.comprimento ? `- Comprimento inserido: ${form.comprimento} cm` : ""}
- Número de punções: ${form.npuncoes}
- Guia ecográfico: sim
${form.fixacao ? `- Fixação: ${form.fixacao === "pontos" ? "fixado com pontos" : "fixado com Statlock"}` : ""}
${form.rx ? `- RX pós-procedimento: ${form.rx}` : ""}
${comp ? `- Complicações: ${comp}` : ""}
${extras ? `- Adicionais: ${extras}` : ""}
Inclua apenas os campos presentes. Complicações só se houver.`;
}

function ProcForm({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleTipo = v => setForm({ ...INITIAL, tipo: v });
  const isArterial = form.tipo === "arterial";
  const inp = { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };
  const g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 };

  return (
    React.createElement('div', { style: { marginBottom: 8 } },
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { style: lbl }, "Tipo de acesso"),
        React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
          Object.entries(TIPOS_LABEL).map(([k, v]) =>
            React.createElement('button', { key: k, onClick: () => handleTipo(k), style: { padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "2px solid", cursor: "pointer", borderColor: form.tipo === k ? "#1e3a5f" : "#d1d5db", background: form.tipo === k ? "#1e3a5f" : "#fff", color: form.tipo === k ? "#fff" : "#374151", fontWeight: form.tipo === k ? 600 : 400 } }, v)
          )
        )
      ),

      form.tipo && React.createElement('div', null,
        React.createElement('div', { style: g2 },
          React.createElement('div', null,
            React.createElement('div', { style: lbl }, "Vaso puncionado"),
            React.createElement('select', { style: inp, value: form.vaso, onChange: e => set("vaso", e.target.value) },
              React.createElement('option', { value: "" }, "Selecione..."),
              ...VASOS_POR_ACESSO[form.tipo].map(v => React.createElement('option', { key: v }, v))
            )
          )
        ),

        !isArterial && React.createElement('div', null,
          React.createElement('div', { style: g2 },
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Cateter"),
              React.createElement('select', { style: inp, value: form.cateter, onChange: e => set("cateter", e.target.value) },
                React.createElement('option', { value: "" }, "Selecione..."),
                ...CATETERES_POR_ACESSO[form.tipo].map(v => React.createElement('option', { key: v }, v))
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Nº de punções"),
              React.createElement('select', { style: inp, value: form.npuncoes, onChange: e => set("npuncoes", e.target.value) },
                ...["1","2","3","4","5+"].map(v => React.createElement('option', { key: v }, v))
              )
            )
          ),
          React.createElement('div', { style: g2 },
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Calibre (Fr)"),
              React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                ...[5,6,7,8,9,10,11,12,13].map(n =>
                  React.createElement('button', { key: n, onClick: () => set("calibre", String(n)), style: { padding: "4px 10px", borderRadius: 16, fontSize: 12, border: "2px solid", cursor: "pointer", borderColor: form.calibre === String(n) ? "#1e3a5f" : "#d1d5db", background: form.calibre === String(n) ? "#1e3a5f" : "#fff", color: form.calibre === String(n) ? "#fff" : "#374151", fontWeight: 600 } }, n)
                )
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Comprimento (cm)"),
              React.createElement('input', { style: inp, placeholder: "ex: 15", value: form.comprimento, onChange: e => set("comprimento", e.target.value) })
            )
          ),
          React.createElement('div', { style: g2 },
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Fixação"),
              React.createElement('select', { style: inp, value: form.fixacao, onChange: e => set("fixacao", e.target.value) },
                React.createElement('option', { value: "" }, "Selecione..."),
                React.createElement('option', { value: "pontos" }, "Pontos"),
                React.createElement('option', { value: "statlock" }, "Statlock")
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Via para NPT"),
              React.createElement('select', { style: inp, value: form.npt, onChange: e => set("npt", e.target.value) },
                React.createElement('option', { value: "nao" }, "Não"),
                React.createElement('option', { value: "sim" }, "Sim")
              )
            )
          ),
          React.createElement('div', { style: g2 },
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Flush VD (confirmação ecocardiográfica)"),
              React.createElement('select', { style: inp, value: form.flush, onChange: e => set("flush", e.target.value) },
                React.createElement('option', { value: "nao" }, "Não"),
                React.createElement('option', { value: "sim" }, "Sim")
              )
            ),
            React.createElement('div', null,
              React.createElement('div', { style: lbl }, "Insonação jugular ipsilateral"),
              React.createElement('select', { style: inp, value: form.jugular, onChange: e => set("jugular", e.target.value) },
                React.createElement('option', { value: "nao" }, "Não"),
                React.createElement('option', { value: "sim" }, "Sim")
              )
            )
          ),
          React.createElement('div', { style: { marginBottom: 16 } },
            React.createElement('div', { style: lbl }, "RX pós-procedimento"),
            React.createElement('select', { style: inp, value: form.rx, onChange: e => set("rx", e.target.value) },
              React.createElement('option', { value: "" }, "Selecione..."),
              ...RX_OPTS.map(v => React.createElement('option', { key: v }, v))
            )
          )
        ),

        React.createElement('div', { style: { marginBottom: 8 } },
          React.createElement('div', { style: lbl }, "Complicações imediatas"),
          React.createElement('select', { style: inp, value: form.complicacao, onChange: e => set("complicacao", e.target.value) },
            React.createElement('option', { value: "" }, "Selecione..."),
            ...COMP_OPTS.map(v => React.createElement('option', { key: v }, v))
          ),
          form.complicacao === "Outro" && React.createElement('input', { style: { ...inp, marginTop: 8 }, placeholder: "Descreva...", value: form.comp_outro, onChange: e => set("comp_outro", e.target.value) })
        )
      )
    )
  );
}

function App() {
  const [tab, setTab] = useState("form");
  const [form1, setForm1] = useState(INITIAL);
  const [form2, setForm2] = useState(INITIAL);
  const [segundo, setSegundo] = useState(false);
  const [evolucoes, setEvolucoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [registros, setRegistros] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  });
  const [expandido, setExpandido] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("puncao_apikey") || "");

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
  }, [registros]);

  const canGenerate = form1.tipo && form1.vaso && apiKey;

  const gerarUm = async (form) => {
    const res = await fetch("/api/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: buildPrompt(form), apiKey }),
    });
    const data = await res.json();
    const txt = data.content?.find(b => b.type === "text")?.text;
    if (!txt) throw new Error("Resposta vazia");
    return txt;
  };

  const gerar = async () => {
    setLoading(true); setEvolucoes([]);
    try {
      const txt1 = await gerarUm(form1);
      const txts = [txt1];
      if (segundo && form2.tipo && form2.vaso) {
        const txt2 = await gerarUm(form2);
        txts.push(txt2);
      }
      setEvolucoes(txts);
      const comp1 = form1.complicacao === "Outro" ? form1.comp_outro : form1.complicacao;
      const comp2 = form2.complicacao === "Outro" ? form2.comp_outro : form2.complicacao;
      const procs = [{ ...form1, complicacao: comp1, evolucao: txt1 }];
      if (txts.length > 1) procs.push({ ...form2, complicacao: comp2, evolucao: txts[1] });
      setRegistros(prev => [{ id: Date.now(), ts: Date.now(), procs }, ...prev]);
    } catch { setEvolucoes(["Erro ao gerar evolução. Tente novamente."]); }
    setLoading(false);
  };

  const copiar = (idx) => {
    const txt = evolucoes[idx];
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(txt).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000); });
      } else {
        const el = document.createElement("textarea"); el.value = txt; el.style.position = "fixed"; el.style.opacity = "0";
        document.body.appendChild(el); el.focus(); el.select(); document.execCommand("copy"); document.body.removeChild(el);
        setCopied(idx); setTimeout(() => setCopied(null), 2000);
      }
    } catch { setCopied(null); }
  };

  const salvarKey = () => { localStorage.setItem("puncao_apikey", apiKey); setShowKey(false); };

  const counts = Object.keys(TIPOS_LABEL).map(k => ({
    label: TIPOS_LABEL[k],
    n: registros.flatMap(r => r.procs).filter(p => p.tipo === k).length
  })).filter(x => x.n > 0);
  const total = registros.flatMap(r => r.procs).length;

  const inp = { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };

  return React.createElement('div', { style: { fontFamily: "Inter, system-ui, sans-serif", background: "#f0f4f8", minHeight: "100vh", padding: "24px 16px" } },
    React.createElement('div', { style: { maxWidth: 640, margin: "0 auto" } },

      React.createElement('div', { style: { background: "#1e3a5f", borderRadius: 12, padding: "16px 24px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement('div', null,
          React.createElement('h1', { style: { color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 } }, "Punção Vascular"),
          React.createElement('p', { style: { color: "#a8c4e0", fontSize: 13, margin: "4px 0 0" } }, "Gerador de evolução para prontuário")
        ),
        React.createElement('button', { onClick: () => setShowKey(!showKey), style: { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, cursor: "pointer" } }, "⚙ API Key")
      ),

      showKey && React.createElement('div', { style: { background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } },
        React.createElement('div', { style: lbl }, "Chave API Anthropic"),
        React.createElement('input', { style: { ...inp, marginBottom: 10 }, type: "password", placeholder: "sk-ant-...", value: apiKey, onChange: e => setApiKey(e.target.value) }),
        React.createElement('button', { onClick: salvarKey, style: { padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "#1e3a5f", color: "#fff", fontSize: 13, fontWeight: 700 } }, "Salvar")
      ),

      !apiKey && React.createElement('div', { style: { background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" } },
        "⚠ Configure sua API Key clicando em ⚙ API Key no cabeçalho."
      ),

      React.createElement('div', { style: { display: "flex", gap: 8, marginBottom: 20 } },
        [["form","Novo Procedimento"], ["registros", `Registros (${registros.length})`]].map(([k, v]) =>
          React.createElement('button', { key: k, onClick: () => setTab(k), style: { flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: tab === k ? "#1e3a5f" : "#fff", color: tab === k ? "#fff" : "#6b7280", boxShadow: tab === k ? "none" : "0 1px 4px rgba(0,0,0,0.08)" } }, v)
        )
      ),

      tab === "form" && React.createElement('div', null,
        React.createElement('div', { style: { background: "#fff", borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } },

          segundo && React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e5e7eb" } }, "1º Procedimento"),
          React.createElement(ProcForm, { form: form1, setForm: setForm1 }),

          segundo && React.createElement('div', { style: { marginTop: 24, paddingTop: 20, borderTop: "2px dashed #e5e7eb" } },
            React.createElement('div', { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
              React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1 } }, "2º Procedimento"),
              React.createElement('button', { onClick: () => { setSegundo(false); setForm2(INITIAL); }, style: { background: "none", border: "none", color: "#ef4444", fontSize: 13, cursor: "pointer", fontWeight: 600 } }, "✕ Remover")
            ),
            React.createElement(ProcForm, { form: form2, setForm: setForm2 })
          ),

          !segundo && React.createElement('button', { onClick: () => setSegundo(true), style: { width: "100%", padding: "10px 0", borderRadius: 10, border: "2px dashed #d1d5db", cursor: "pointer", background: "#fff", color: "#6b7280", fontSize: 13, fontWeight: 600, marginBottom: 16, marginTop: 8 } }, "+ Adicionar 2º procedimento"),

          form1.tipo && React.createElement('button', { onClick: gerar, disabled: !canGenerate || loading, style: { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: canGenerate && !loading ? "pointer" : "not-allowed", background: canGenerate && !loading ? "#1e3a5f" : "#9ca3af", color: "#fff", fontSize: 15, fontWeight: 700, marginTop: 8 } },
            loading ? "Gerando..." : segundo ? "Gerar evoluções" : "Gerar evolução"
          )
        ),

        evolucoes.map((txt, idx) =>
          React.createElement('div', { key: idx, style: { background: "#fff", borderRadius: 12, padding: 24, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } },
            React.createElement('div', { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
              React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1 } }, evolucoes.length > 1 ? `Evolução ${idx + 1}` : "Evolução gerada"),
              React.createElement('button', { onClick: () => copiar(idx), style: { padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: copied === idx ? "#16a34a" : "#e5e7eb", color: copied === idx ? "#fff" : "#374151", fontSize: 13, fontWeight: 600 } }, copied === idx ? "✓ Copiado!" : "Copiar")
            ),
            React.createElement('p', { style: { fontSize: 14, lineHeight: 1.8, color: "#1f2937", margin: 0, whiteSpace: "pre-wrap" } }, txt)
          )
        ),

        evolucoes.length > 0 && React.createElement('button', { onClick: () => { setEvolucoes([]); setForm1(INITIAL); setForm2(INITIAL); setSegundo(false); }, style: { padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db", cursor: "pointer", background: "#fff", color: "#6b7280", fontSize: 13 } }, "Novo procedimento")
      ),

      tab === "registros" && React.createElement('div', { style: { background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } },
        registros.length === 0
          ? React.createElement('p', { style: { color: "#9ca3af", fontSize: 14, textAlign: "center", margin: "32px 0" } }, "Nenhum procedimento registrado ainda.")
          : React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: 20 } },
                React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "Resumo"),
                React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 } },
                  ...counts.map(c => React.createElement('div', { key: c.label, style: { background: "#f0f4f8", borderRadius: 8, padding: "6px 14px", fontSize: 13 } },
                    React.createElement('span', { style: { fontWeight: 700, color: "#1e3a5f" } }, `${c.n}× `),
                    React.createElement('span', { style: { color: "#374151" } }, c.label)
                  )),
                  React.createElement('div', { style: { background: "#1e3a5f", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#fff", fontWeight: 700 } }, `Total: ${total}`)
                ),
                React.createElement('button', { onClick: () => exportCSV(registros), style: { padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700 } }, "⬇ Exportar Excel (.csv)")
              ),
              React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "Atendimentos"),
              React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 10 } },
                ...registros.map((r, i) =>
                  React.createElement('div', { key: r.id, style: { border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" } },
                    React.createElement('div', { onClick: () => setExpandido(expandido === i ? null : i), style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: expandido === i ? "#f0f4f8" : "#fff" } },
                      React.createElement('div', null,
                        React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: "#1e3a5f" } }, r.procs.map(p => TIPOS_LABEL[p.tipo]).join(" + ")),
                        React.createElement('div', { style: { fontSize: 12, color: "#6b7280", marginTop: 2 } }, `${r.procs.map(p => p.vaso).join(" · ")} · ${fmtDate(r.ts)}`)
                      ),
                      React.createElement('span', { style: { color: "#9ca3af", fontSize: 16 } }, expandido === i ? "▲" : "▼")
                    ),
                    expandido === i && React.createElement('div', { style: { padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#fafafa" } },
                      r.procs.map((p, pi) =>
                        React.createElement('div', { key: pi, style: { marginBottom: pi < r.procs.length - 1 ? 16 : 0 } },
                          r.procs.length > 1 && React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", marginBottom: 6, textTransform: "uppercase" } }, `${pi + 1}º procedimento`),
                          p.cateter && React.createElement('div', { style: { fontSize: 13, color: "#374151", marginBottom: 3 } }, React.createElement('b', null, "Cateter: "), p.cateter),
                          p.calibre && React.createElement('div', { style: { fontSize: 13, color: "#374151", marginBottom: 3 } }, React.createElement('b', null, "Calibre: "), `${p.calibre} Fr`),
                          p.comprimento && React.createElement('div', { style: { fontSize: 13, color: "#374151", marginBottom: 3 } }, React.createElement('b', null, "Comprimento: "), `${p.comprimento} cm`),
                          p.complicacao && React.createElement('div', { style: { fontSize: 13, color: "#374151", marginBottom: 3 } }, React.createElement('b', null, "Complicação: "), p.complicacao),
                          React.createElement('div', { style: { fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, p.evolucao)
                        )
                      )
                    )
                  )
                )
              )
            )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
