# Padrões locais do BudgetApp

Este arquivo registra convenções observadas no código existente para alterações feitas pelo Codex.

## Backend C#

- Preservar `namespace BudgetAPI.X { ... }` com chaves em linhas próprias quando o arquivo existente usa esse formato.
- Manter métodos, `if`, `try/catch` e blocos de configuração com chaves em linhas próprias.
- Em consultas LINQ encadeadas, alinhar cada etapa abaixo da expressão inicial:

  ```csharp
  IQueryable<Item> query =
      _context.Items
              .Where(...)
              .Join(...)
              .Select(...);
  ```

- Quebrar chamadas longas em argumentos e etapas alinhadas; não concentrar consultas, condicionais ou atribuições múltiplas em uma linha.
- Manter declarações locais explícitas quando o arquivo já usa esse padrão (`IQueryable<T> query`, `AccountsPostings? posting`, etc.).
- Usar `var` somente quando o tipo for imediatamente explícito pelo lado direito, como `var account = ...` ou `var income = ...`; preferir o tipo declarado quando o tipo não for óbvio ou quando a declaração melhorar o contrato do código.
- Em construtores e campos, preservar o alinhamento visual existente apenas no bloco em que ele já é usado; não aplicar alinhamento global automaticamente.
- Em inicializadores de objetos, alinhar os operadores `=` das propriedades do mesmo objeto com espaços, como em `AccountId   = ...`, `Date        = ...` e `Position    = ...`.
- Não substituir esse alinhamento por `AccountId = ...` nem por tabs; whitespace faz parte do padrão visual local.
- Em configurações EF, manter uma chamada por linha quando a cadeia ficar extensa, com `.WithMany()`, `.HasForeignKey()` e `.OnDelete()` indentados.
- Não reformatar arquivos inteiros sem necessidade; seguir o estilo do arquivo e das linhas vizinhas.
- Os arquivos existentes usam CRLF. Depois de qualquer edição, verificar as terminações do arquivo inteiro e normalizar para CRLF; não deixar mistura de LF e CRLF.
- Em serviços C#, separar visualmente o bloco de variáveis da lógica seguinte; deixar uma linha em branco antes e depois de `if`, `foreach`, `while` e blocos de processamento.
- Não manter múltiplas declarações, chamadas ou comandos de controle na mesma linha, mesmo que o compilador aceite.

## Frontend TypeScript/HTML

- Manter métodos TypeScript com corpo multilinha e quebrar getters, objetos, callbacks e expressões longas.
- Em templates Angular, quebrar componentes com muitos atributos em várias linhas, seguindo o padrão Material já existente.
- Evitar vários elementos HTML ou bindings longos na mesma linha.
- Preservar acentuação UTF-8 e o texto original do projeto.

## Regra de aplicação

Antes de editar, consultar este arquivo e observar também o trecho vizinho do arquivo-alvo. O padrão local do arquivo tem precedência sobre qualquer formatter automático.
