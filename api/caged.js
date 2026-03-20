const { BigQuery } = require('@google-cloud/bigquery');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
return res.status(200).end();
  }

  const { cnpj } = req.query;

  if (!cnpj) {
return res.status(400).json({ error: 'CNPJ é obrigatório' });
  }

  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS;
  if (!credentialsJson) {
return res.status(500).json({ error: 'Credenciais não configuradas' });
  }

  try {
const credentials = JSON.parse(credentialsJson);
const bigquery = new BigQuery({
  credentials: credentials,
  projectId: credentials.project_id
});

const cnpjLimpo = cnpj.replace(/\D/g, '').padStart(14, '0');

const query = `
  SELECT 
    ano,
    mes,
    SUM(CASE WHEN saldomovimentacao = 1 THEN 1 ELSE 0 END) as admissoes,
    SUM(CASE WHEN saldomovimentacao = -1 THEN 1 ELSE 0 END) as demissoes,
    SUM(saldomovimentacao) as saldo,
    AVG(salario) as salario_medio
  FROM \`basedosdados.br_me_caged.microdados_movimentacao\`
  WHERE cnpj_basico = @cnpj_basico
  GROUP BY ano, mes
  ORDER BY ano DESC, mes DESC
`;

const cnpjBasico = cnpjLimpo.substring(0, 8);

const options = {
  query: query,
  params: { cnpj_basico: cnpjBasico },
  location: 'US'
};

const [rows] = await bigquery.query(options);

if (rows.length === 0) {
  return res.status(200).json({
    found: false,
    cnpj: cnpjLimpo,
    message: 'Nenhum dado CAGED encontrado para este CNPJ'
  });
}

let totalAdmissoes = 0;
let totalDemissoes = 0;
let somasSalarios = 0;
let countSalarios = 0;

rows.forEach(row => {
  totalAdmissoes += row.admissoes || 0;
  totalDemissoes += row.demissoes || 0;
  if (row.salario_medio) {
    somasSalarios += row.salario_medio;
    countSalarios++;
  }
});

const saldoFinal = totalAdmissoes - totalDemissoes;
const salarioMedio = countSalarios > 0 ? somasSalarios / countSalarios : null;

return res.status(200).json({
  found: true,
  cnpj: cnpjLimpo,
  saldo_funcionarios: saldoFinal,
  total_admissoes: totalAdmissoes,
  total_demissoes: totalDemissoes,
  salario_medio: salarioMedio ? salarioMedio.toFixed(2) : null,
  primeiro_ano: rows[rows.length - 1]?.ano,
  ultimo_ano: rows[0]?.ano,
  historico: rows
});

  } catch (error) {
console.error('Erro:', error);
return res.status(500).json({ error: error.message });
  }
};
