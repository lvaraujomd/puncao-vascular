const { useState, useRef } = React;

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
  npuncoes: "1", us: "sim", fixacao: "", npt: "nao",
  flush: "nao", jugular: "nao", rx: "", complicacao: "", comp_outro: "",
};
const STORAGE_KEY = "puncao_registros_v3";

function fmtDate(d) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function exportCSV(registros) {
  const cols = ["Data Extração","Paciente","Data Procedimento","Setor/Leito","Tipo de Acesso","Vaso","Lado","Calibre (Fr)","Comprimento (cm)","Nº Punções","Ultrassom","Complicações"];
  const rows = registros.map(r => [
    fmtDate(r.ts), r.paciente, r.dataProcedimento, r.setorLeito,
    r.tipoAcesso, r.vaso, r.lado, r.calibre, r.comprimento,
    r.npuncoes, r.ultrassom || "Sim", r.complicacoes
  ]);
  const bom = "\uFEFF";
  const csv = bom + [cols, ...rows].map(row => row.map(c => `"${String(c||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "registros_puncao.csv";
  a.click(); URL.revokeObjectURL(url);
}

function buildPromptUnico(form1, form2) {
  const formatForm = (form) => {
    const isArterial = form.tipo === "arterial";
    const comp = form.complicacao === "Outro" ? form.comp_outro : form.complicacao;
    const extras = [
      form.npt === "sim" ? "Uma via separada foi reservada para NPT." : "",
      form.flush === "sim" ? "Flush dos lúmens realizado com solução fisiológica." : "",
      form.jugular === "sim" ? "Insonação da jugular ipsilateral realizada ao final, sem evidência de migração cefálica do cateter." : "",
    ].filter(Boolean).join(" ");
    if (isArterial) {
      return `Procedimento: Punção arterial
- Vaso: ${form.vaso}
- Guia ecográfico: ${form.us === "sim" ? "sim" : "não"}
${comp ? `- Complicações: ${comp}` : ""}`;
    }
    return `Procedimento: ${TIPOS_LABEL[form.tipo]}
- Vaso: ${form.vaso}
${form.cateter ? `- Cateter: ${form.cateter}` : ""}
${form.calibre ? `- Calibre: ${form.calibre} Fr` : ""}
${form.comprimento ? `- Comprimento inserido: ${form.comprimento} cm` : ""}
- Número de punções: ${form.npuncoes}
- Guia ecográfico: ${form.us === "sim" ? "sim" : "não"}
${form.fixacao ? `- Fixação: ${form.fixacao === "pontos" ? "fixado com pontos" : "fixado com Statlock"}` : ""}
${form.rx ? `- RX pós-procedimento: ${form.rx}` : ""}
${comp ? `- Complicações: ${comp}` : ""}
${extras ? `- Adicionais: ${extras}` : ""}`;
  };

  const temSegundo = form2 && form2.tipo && form2.vaso;
  if (!temSegundo) {
    return `Você é um médico intensivista brasileiro redigindo evolução de procedimento para prontuário. Português, linguagem médica formal, texto corrido, sem marcadores, sem cabeçalho, sem markdown. Máximo 4 linhas, um parágrafo. Inclua apenas os campos presentes.\n\n${formatForm(form1)}`;
  }
  return `Você é um médico intensivista brasileiro redigindo evolução de procedimento para prontuário. Português, linguagem médica formal, texto corrido, sem marcadores, sem cabeçalho, sem markdown. Máximo 6 linhas, UM único parágrafo contínuo descrevendo os dois procedimentos realizados no mesmo atendimento, em sequência. Inclua apenas os campos presentes.\n\n${formatForm(form1)}\n\n${formatForm(form2)}`;
}

const S = {
  inp: { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" },
  lbl: { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 },
  card: { background: "#fff", borderRadius: 12, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
};

function ProcForm({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleTipo = v => setForm({ ...INITIAL, tipo: v });
  const isArterial = form.tipo === "arterial";

  return React.createElement('div', null,
    React.createElement('div', { style: { marginBottom: 20 } },
      React.createElement('div', { style: S.lbl }, "Tipo de acesso"),
      React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
        ...Object.entries(TIPOS_LABEL).map(([k, v]) =>
          React.createElement('button', { key: k, onClick: () => handleTipo(k), style: { padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "2px solid", cursor: "pointer", borderColor: form.tipo === k ? "#1e3a5f" : "#d1d5db", background: form.tipo === k ? "#1e3a5f" : "#fff", color: form.tipo === k ? "#fff" : "#374151", fontWeight: form.tipo === k ? 600 : 400 } }, v)
        )
      )
    ),
    form.tipo && React.createElement('div', null,
      React.createElement('div', { style: S.g2 },
        React.createElement('div', null,
          React.createElement('div', { style: S.lbl }, "Vaso puncionado"),
          React.createElement('select', { style: S.inp, value: form.vaso, onChange: e => set("vaso", e.target.value) },
            React.createElement('option', { value: "" }, "Selecione..."),
            ...VASOS_POR_ACESSO[form.tipo].map(v => React.createElement('option', { key: v }, v))
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { style: S.lbl }, "Guia ecográfico (US)"),
          React.createElement('select', { style: S.inp, value: form.us, onChange: e => set("us", e.target.value) },
            React.createElement('option', { value: "sim" }, "Sim"),
            React.createElement('option', { value: "nao" }, "Não")
          )
        )
      ),
      !isArterial && React.createElement('div', null,
        React.createElement('div', { style: S.g2 },
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Cateter"),
            React.createElement('select', { style: S.inp, value: form.cateter, onChange: e => set("cateter", e.target.value) },
              React.createElement('option', { value: "" }, "Selecione..."),
              ...CATETERES_POR_ACESSO[form.tipo].map(v => React.createElement('option', { key: v }, v))
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Nº de punções"),
            React.createElement('select', { style: S.inp, value: form.npuncoes, onChange: e => set("npuncoes", e.target.value) },
              ...["1","2","3","4","5+"].map(v => React.createElement('option', { key: v }, v))
            )
          )
        ),
        React.createElement('div', { style: S.g2 },
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Calibre (Fr)"),
            React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
              ...[5,6,7,8,9,10,11,12,13].map(n =>
                React.createElement('button', { key: n, onClick: () => set("calibre", String(n)), style: { padding: "4px 10px", borderRadius: 16, fontSize: 12, border: "2px solid", cursor: "pointer", borderColor: form.calibre === String(n) ? "#1e3a5f" : "#d1d5db", background: form.calibre === String(n) ? "#1e3a5f" : "#fff", color: form.calibre === String(n) ? "#fff" : "#374151", fontWeight: 600 } }, n)
              )
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Comprimento (cm)"),
            React.createElement('input', { style: S.inp, placeholder: "ex: 15", value: form.comprimento, onChange: e => set("comprimento", e.target.value) })
          )
        ),
        React.createElement('div', { style: S.g2 },
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Fixação"),
            React.createElement('select', { style: S.inp, value: form.fixacao, onChange: e => set("fixacao", e.target.value) },
              React.createElement('option', { value: "" }, "Selecione..."),
              React.createElement('option', { value: "pontos" }, "Pontos"),
              React.createElement('option', { value: "statlock" }, "Statlock")
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Via para NPT"),
            React.createElement('select', { style: S.inp, value: form.npt, onChange: e => set("npt", e.target.value) },
              React.createElement('option', { value: "nao" }, "Não"),
              React.createElement('option', { value: "sim" }, "Sim")
            )
          )
        ),
        React.createElement('div', { style: S.g2 },
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Flush lúmens (SF)"),
            React.createElement('select', { style: S.inp, value: form.flush, onChange: e => set("flush", e.target.value) },
              React.createElement('option', { value: "nao" }, "Não"),
              React.createElement('option', { value: "sim" }, "Sim")
            )
          ),
          React.createElement('div', null,
            React.createElement('div', { style: S.lbl }, "Insonação jugular ipsilateral"),
            React.createElement('select', { style: S.inp, value: form.jugular, onChange: e => set("jugular", e.target.value) },
              React.createElement('option', { value: "nao" }, "Não"),
              React.createElement('option', { value: "sim" }, "Sim")
            )
          )
        ),
        React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement('div', { style: S.lbl }, "RX pós-procedimento"),
          React.createElement('select', { style: S.inp, value: form.rx, onChange: e => set("rx", e.target.value) },
            React.createElement('option', { value: "" }, "Selecione..."),
            ...RX_OPTS.map(v => React.createElement('option', { key: v }, v))
          )
        )
      ),
      React.createElement('div', { style: { marginBottom: 8 } },
        React.createElement('div', { style: S.lbl }, "Complicações imediatas"),
        React.createElement('select', { style: S.inp, value: form.complicacao, onChange: e => set("complicacao", e.target.value) },
          React.createElement('option', { value: "" }, "Selecione..."),
          ...COMP_OPTS.map(v => React.createElement('option', { key: v }, v))
        ),
        form.complicacao === "Outro" && React.createElement('input', { style: { ...S.inp, marginTop: 8 }, placeholder: "Descreva...", value: form.comp_outro, onChange: e => set("comp_outro", e.target.value) })
      )
    )
  );
}

function App() {
  const [tab, setTab] = useState("gerar");
  const [form1, setForm1] = useState(INITIAL);
  const [form2, setForm2] = useState(INITIAL);
  const [segundo, setSegundo] = useState(false);
  const [evolucao, setEvolucao] = useState("");
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [registros, setRegistros] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  });
  const [expandido, setExpandido] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("puncao_apikey") || "");
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [loadingFoto, setLoadingFoto] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState(null);
  const [editando, setEditando] = useState({});
  const fileRef = useRef();

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
  }, [registros]);

  const salvarKey = () => { localStorage.setItem("puncao_apikey", apiKey); setShowKey(false); };
  const canGenerate = form1.tipo && form1.vaso && apiKey;

  const gerar = async () => {
    setLoadingGerar(true); setEvolucao("");
    try {
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPromptUnico(form1, segundo ? form2 : null), apiKey }),
      });
      const data = await res.json();
      setEvolucao(data.content?.find(b => b.type === "text")?.text || "Erro ao gerar.");
    } catch { setEvolucao("Erro ao gerar evolução. Tente novamente."); }
    setLoadingGerar(false);
  };

  const copiar = () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(evolucao).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
      } else {
        const el = document.createElement("textarea"); el.value = evolucao; el.style.position = "fixed"; el.style.opacity = "0";
        document.body.appendChild(el); el.focus(); el.select(); document.execCommand("copy"); document.body.removeChild(el);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file); setFotoPreview(URL.createObjectURL(file));
    setDadosExtraidos(null); setEditando({});
  };

  const extrairDados = async () => {
    if (!foto || !apiKey) return;
    setLoadingFoto(true);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(foto);
      });
      const res = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: foto.type || "image/jpeg", data: b64 } },
              { type: "text", text: `Analise esta evolução médica de procedimento de punção vascular e extraia as seguintes informações em formato JSON puro (sem markdown, sem backticks):\n{\n  "paciente": "",\n  "dataProcedimento": "",\n  "setorLeito": "",\n  "tipoAcesso": "",\n  "vaso": "",\n  "lado": "",\n  "calibre": "",\n  "comprimento": "",\n  "npuncoes": "",\n  "ultrassom": "",\n  "complicacoes": ""\n}\nRetorne APENAS o JSON.` }
            ]
          }]
        }),
      });
      const data = await res.json();
      const txt = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      setDadosExtraidos(parsed); setEditando(parsed);
    } catch { alert("Erro ao extrair dados. Tente novamente."); }
    setLoadingFoto(false);
  };

  const salvarRegistro = () => {
    setRegistros(prev => [{ id: Date.now(), ts: Date.now(), ...editando }, ...prev]);
    setFoto(null); setFotoPreview(null); setDadosExtraidos(null); setEditando({});
    setTab("exportar");
  };

  const camposLabel = {
    paciente: "Paciente", dataProcedimento: "Data do procedimento", setorLeito: "Setor/Leito",
    tipoAcesso: "Tipo de acesso", vaso: "Vaso", lado: "Lado", calibre: "Calibre (Fr)",
    comprimento: "Comprimento (cm)", npuncoes: "Nº de punções", ultrassom: "Ultrassom", complicacoes: "Complicações"
  };

  const counts = {};
  registros.forEach(r => { counts[r.tipoAcesso] = (counts[r.tipoAcesso] || 0) + 1; });
  const TABS = [["gerar","Gerar"], ["registrar","Registrar"], ["exportar", `Exportar (${registros.length})`]];

  return React.createElement('div', { style: { fontFamily: "Inter, system-ui, sans-serif", background: "#f0f4f8", minHeight: "100vh", padding: "24px 16px" } },
    React.createElement('div', { style: { maxWidth: 640, margin: "0 auto" } },

      React.createElement('div', { style: { background: "#1e3a5f", borderRadius: 12, padding: "16px 24px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement('div', null,
          React.createElement('h1', { style: { color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 } }, "Punção Vascular"),
          React.createElement('p', { style: { color: "#a8c4e0", fontSize: 13, margin: "4px 0 0" } }, "Copa Star · INCA")
        ),
        React.createElement('button', { onClick: () => setShowKey(!showKey), style: { background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", color: apiKey ? "#a8e6cf" : "#ffd3a8", fontSize: 12, cursor: "pointer" } }, apiKey ? "✓ API" : "⚙ API Key")
      ),

      showKey && React.createElement('div', { style: S.card },
        React.createElement('div', { style: S.lbl }, "Chave API Anthropic"),
        React.createElement('input', { style: { ...S.inp, marginBottom: 10 }, type: "password", placeholder: "sk-ant-...", value: apiKey, onChange: e => setApiKey(e.target.value) }),
        React.createElement('button', { onClick: salvarKey, style: { padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "#1e3a5f", color: "#fff", fontSize: 13, fontWeight: 700 } }, "Salvar")
      ),

      !apiKey && React.createElement('div', { style: { background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" } }, "⚠ Configure sua API Key clicando em ⚙ API Key no cabeçalho."),

      React.createElement('div', { style: { display: "flex", gap: 8, marginBottom: 20 } },
        ...TABS.map(([k, v]) =>
          React.createElement('button', { key: k, onClick: () => setTab(k), style: { flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: tab === k ? "#1e3a5f" : "#fff", color: tab === k ? "#fff" : "#6b7280", boxShadow: tab === k ? "none" : "0 1px 4px rgba(0,0,0,0.08)" } }, v)
        )
      ),

      // ABA GERAR
      tab === "gerar" && React.createElement('div', null,
        React.createElement('div', { style: S.card },
          segundo && React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e5e7eb" } }, "1º Procedimento"),
          React.createElement(ProcForm, { form: form1, setForm: setForm1 }),
          segundo && React.createElement('div', { style: { marginTop: 24, paddingTop: 20, borderTop: "2px dashed #e5e7eb" } },
            React.createElement('div', { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
              React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1 } }, "2º Procedimento"),
              React.createElement('button', { onClick: () => { setSegundo(false); setForm2(INITIAL); }, style: { background: "none", border: "none", color: "#ef4444", fontSize: 13, cursor: "pointer", fontWeight: 600 } }, "✕ Remover")
            ),
            React.createElement(ProcForm, { form: form2, setForm: setForm2 })
          ),
          !segundo && React.createElement('button', { onClick: () => setSegundo(true), style: { width: "100%", padding: "10px 0", borderRadius: 10, border: "2px dashed #d1d5db", cursor: "pointer", background: "#fff", color: "#6b7280", fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 } }, "+ Adicionar 2º procedimento"),
          form1.tipo && React.createElement('button', { onClick: gerar, disabled: !canGenerate || loadingGerar, style: { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", marginTop: 8, cursor: canGenerate && !loadingGerar ? "pointer" : "not-allowed", background: canGenerate && !loadingGerar ? "#1e3a5f" : "#9ca3af", color: "#fff", fontSize: 15, fontWeight: 700 } }, loadingGerar ? "Gerando..." : "Gerar evolução")
        ),
        evolucao && React.createElement('div', { style: S.card },
          React.createElement('div', { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
            React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1 } }, "Evolução gerada"),
            React.createElement('button', { onClick: copiar, style: { padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: copied ? "#16a34a" : "#e5e7eb", color: copied ? "#fff" : "#374151", fontSize: 13, fontWeight: 600 } }, copied ? "✓ Copiado!" : "Copiar")
          ),
          React.createElement('p', { style: { fontSize: 14, lineHeight: 1.8, color: "#1f2937", margin: 0, whiteSpace: "pre-wrap" } }, evolucao),
          React.createElement('button', { onClick: () => { setEvolucao(""); setForm1(INITIAL); setForm2(INITIAL); setSegundo(false); }, style: { marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db", cursor: "pointer", background: "#fff", color: "#6b7280", fontSize: 13 } }, "Novo procedimento")
        )
      ),

      // ABA REGISTRAR
      tab === "registrar" && React.createElement('div', null,
        React.createElement('div', { style: S.card },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 } }, "Foto da evolução"),
          React.createElement('div', { onClick: () => fileRef.current.click(), style: { border: "2px dashed #d1d5db", borderRadius: 10, padding: "32px 16px", textAlign: "center", cursor: "pointer", background: "#f9fafb", marginBottom: 16 } },
            fotoPreview
              ? React.createElement('img', { src: fotoPreview, style: { maxWidth: "100%", maxHeight: 300, borderRadius: 8 } })
              : React.createElement('div', null,
                  React.createElement('div', { style: { fontSize: 32, marginBottom: 8 } }, "📷"),
                  React.createElement('div', { style: { fontSize: 14, color: "#6b7280" } }, "Toque para tirar foto ou selecionar imagem")
                )
          ),
          React.createElement('input', { ref: fileRef, type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: handleFoto }),
          foto && !dadosExtraidos && React.createElement('button', { onClick: extrairDados, disabled: loadingFoto || !apiKey, style: { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: apiKey ? "pointer" : "not-allowed", background: apiKey ? "#1e3a5f" : "#9ca3af", color: "#fff", fontSize: 15, fontWeight: 700 } }, loadingFoto ? "Extraindo dados..." : "Extrair dados da foto")
        ),
        dadosExtraidos && React.createElement('div', { style: S.card },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 } }, "Dados extraídos — revise e confirme"),
          ...Object.entries(camposLabel).map(([k, label]) =>
            React.createElement('div', { key: k, style: { marginBottom: 12 } },
              React.createElement('div', { style: S.lbl }, label),
              React.createElement('input', { style: S.inp, value: editando[k] || "", onChange: e => setEditando(prev => ({ ...prev, [k]: e.target.value })) })
            )
          ),
          React.createElement('button', { onClick: salvarRegistro, style: { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontSize: 15, fontWeight: 700, marginTop: 8 } }, "✓ Salvar registro")
        )
      ),

      // ABA EXPORTAR
      tab === "exportar" && React.createElement('div', { style: S.card },
        registros.length === 0
          ? React.createElement('p', { style: { color: "#9ca3af", fontSize: 14, textAlign: "center", margin: "32px 0" } }, "Nenhum registro ainda. Use a aba Registrar para extrair dados das fotos.")
          : React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: 20 } },
                React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "Resumo"),
                React.createElement('div', { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 } },
                  ...Object.entries(counts).map(([tipo, n]) =>
                    React.createElement('div', { key: tipo, style: { background: "#f0f4f8", borderRadius: 8, padding: "6px 14px", fontSize: 13 } },
                      React.createElement('span', { style: { fontWeight: 700, color: "#1e3a5f" } }, `${n}× `),
                      React.createElement('span', { style: { color: "#374151" } }, tipo)
                    )
                  ),
                  React.createElement('div', { style: { background: "#1e3a5f", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#fff", fontWeight: 700 } }, `Total: ${registros.length}`)
                ),
                React.createElement('button', { onClick: () => exportCSV(registros), style: { padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700 } }, "⬇ Exportar Excel (.csv)")
              ),
              React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 } }, "Registros"),
              React.createElement('div', { style: { display: "flex", flexDirection: "column", gap: 10 } },
                ...registros.map((r, i) =>
                  React.createElement('div', { key: r.id, style: { border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" } },
                    React.createElement('div', { onClick: () => setExpandido(expandido === i ? null : i), style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", background: expandido === i ? "#f0f4f8" : "#fff" } },
                      React.createElement('div', null,
                        React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: "#1e3a5f" } }, r.paciente || "Paciente não identificado"),
                        React.createElement('div', { style: { fontSize: 12, color: "#6b7280", marginTop: 2 } }, `${r.tipoAcesso} · ${r.dataProcedimento} · ${r.setorLeito}`)
                      ),
                      React.createElement('span', { style: { color: "#9ca3af" } }, expandido === i ? "▲" : "▼")
                    ),
                    expandido === i && React.createElement('div', { style: { padding: "12px 16px", borderTop: "1px solid #e5e7eb", background: "#fafafa", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                      ...Object.entries(camposLabel).filter(([k]) => r[k]).map(([k, label]) =>
                        React.createElement('div', { key: k },
                          React.createElement('div', { style: { fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase" } }, label),
                          React.createElement('div', { style: { fontSize: 13, color: "#374151" } }, r[k])
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
