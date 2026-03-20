const { GoogleAuth } = require('google-auth-library');

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
const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/bigquery'] });
const client = await auth.getClient();
const token = await client.getAccessToken();

const query = `
  SELECT 
    SUM(CASE WHEN tipo_movimentacao = 1 THEN 1 ELSE 0 END) as admissoes,
    SUM(CASE WHEN tipo_movimentacao = 2 THEN 1 ELSE 0 END) as demissoes,
    AVG(salario_mensal) as salario_medio,
    MIN(ano) as primeiro_ano,
    MAX(ano) as ultimo_ano
  FROM \`basedosdados.br_me_caged.microdados_movimentacao\`
  WHERE cnpj_basico = '${cnpj.substring(0, 8)}'
`;

const response = await fetch('https://bigquery.googleapis.com/bigquery/v2/projects/basedosdados/queries', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, useLegacySql: false })
});

const data = await response.json();
if (data.error) {
  return res.status(500).json({ error: data.error.message });
}

const row = data.rows?.[0]?.f || [];
return res.status(200).json({
  found: true,
  total_admissoes: parseInt(row[0]?.v || 0),
  total_demissoes: parseInt(row[1]?.v || 0),
  saldo_funcionarios: parseInt(row[0]?.v || 0) - parseInt(row[1]?.v || 0),
  salario_medio: parseFloat(row[2]?.v || 0),
  primeiro_ano: row[3]?.v,
  ultimo_ano: row[4]?.v
});
  } catch (error) {
return res.status(500).json({ error: error.message });
  }
};
