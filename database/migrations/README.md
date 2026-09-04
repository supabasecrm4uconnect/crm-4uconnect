# Sequência de migrations

Este diretório contém somente mudanças de schema, segurança e compatibilidade que fazem parte da evolução normal do banco.

## Execução

1. Em banco vazio, comece por `01_schema.sql`.
2. Use `02_data_seed.sql` somente em desenvolvimento local.
3. Aplique os demais arquivos em ordem numérica, pulando os números reservados `17`, `20` e `31`.
4. Em produção existente, execute somente migrations ainda não aplicadas e valide primeiro em staging ou em uma cópia do banco.
5. Nunca execute arquivos de `database/operations/` como parte do deploy.

Os números ausentes foram preservados para manter rastreabilidade: eles identificavam operações pontuais que agora estão arquivadas em `database/operations/archive/`.

> Atenção: o projeto ainda usa uma sequência histórica numerada e execução controlada no SQL Editor. Antes de adotar o Supabase CLI, crie uma baseline da produção e reconcilie o histórico para evitar reaplicar mudanças já existentes.
