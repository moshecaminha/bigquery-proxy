const { BigQuery } = require('@google-cloud/bigquery');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
return res.status(200).end();
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

// Query para descobrir as colunas da tabela
const schemaQuery = `
  SELECT column_name, data_type
  FROM \`basedosdados.br_me_caged.INFORMATION_SCHEMA.COLUMNS\`
  WHERE table_name = 'microdados_movimentacao'
  ORDER BY ordinal_position
`;

const [columns] = await bigquery.query({ query: schemaQuery, location: 'US' });

return res.status(200).json({ 
  message: 'Colunas da tabela CAGED',
  columns: columns 
});

  } catch (error) {
console.error('Erro:', error);
return res.status(500).json({ error: error.message });
  }
};
