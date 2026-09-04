# Operações manuais de banco

Este diretório contém rotinas pontuais de manutenção de dados. Elas **não são migrations** e **nunca devem ser executadas em lote**, nem em um ambiente novo, nem durante deploy.

## Regras de segurança

- Execute uma operação somente após auditar o estado atual do banco e confirmar os UUIDs e contagens envolvidos.
- Faça uma simulação ou consulta de pré-validação antes de qualquer `DELETE` ou transferência.
- Obtenha confirmação explícita para ações destrutivas.
- Registre a execução e a pós-validação em `MEMORY.md`.
- Arquivos em `archive/` são evidências históricas. Não os reutilize como procedimento genérico.

## Arquivo histórico

| Operação | Situação |
|---|---|
| `archive/17_delete_test_accounts.sql` | Legada e insegura para reutilização; seleciona alvos por e-mail. |
| `archive/20_deduplicate_statuses_and_cleanup.sql` | Deprecada; podia excluir catálogos sem remapear referências. |
| `archive/25_recover_leads_by_exclusive_audit_evidence.sql` | Executada uma vez para recuperar 220 leads; a estrutura reutilizável ficou na migration 25. |
| `archive/31_transfer_unattributed_leads_to_julia.sql` | Executada uma vez para transferir 106 leads para Julia; destino posteriormente removido. |
| `archive/34_safely_delete_julia_and_teste_accounts.sql` | Executada e pós-validada em produção em 04/09/2026. |
