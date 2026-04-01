const fs = require('fs');

async function executeSql() {
  try {
    const query = fs.readFileSync('C:\\Users\\Erorr\\Desktop\\فيدويهات قطط\\carpet-land\\fix_users_table.sql', 'utf8');
    const projectRef = 'gulaggpzonzylxrwugla';
    const token = 'sbp_eacfe6193ecd92bee4867b250cfea97930906625';

    console.log('Executing SQL against Supabase Management API...');
    
    // Using global fetch available in Node.js 18+
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    });

    if (response.ok) {
      console.log('Success: SQL executed successfully! All tables created.');
      const data = await response.text();
      if (data) console.log(data);
    } else {
      const errorText = await response.text();
      console.error('Failed to execute SQL:', response.status, errorText);
    }
  } catch (error) {
    console.error('Execution error:', error.message);
  }
}

executeSql();
