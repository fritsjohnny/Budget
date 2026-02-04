# 💰 Budget — Frontend

> ⚠️ **Projeto pessoal de controle financeiro**
> Frontend desenvolvido para uso próprio e disponibilizado publicamente **exclusivamente para fins de portfólio técnico**.
> O objetivo deste repositório é demonstrar **habilidades técnicas**, **decisões de arquitetura** e **boas práticas de desenvolvimento**.
> **Não possui finalidade comercial** e **não expõe dados reais, credenciais ou informações sensíveis**.

---

## 🚀 O que é este projeto

O **Budget Frontend** é a interface de um sistema pessoal de controle financeiro, responsável por:

- 📊 Visualização de contas e saldos  
- 📥 Lançamento de receitas e despesas  
- 💳 Gestão de cartões e faturas  
- 🏷️ Organização por categorias  
- 🔔 Acompanhamento do estado financeiro  
- 📱 Execução como aplicação web e app Android  

> Não é um projeto acadêmico.  
> Trata-se de um projeto pessoal, construído e evoluído com base em uso real.

---

## 🧱 Stack principal

| Camada      | Tecnologia                    |
| ----------- | ----------------------------- |
| Framework   | Angular                       |
| Arquitetura | SPA (Single Page Application) |
| Mobile      | Capacitor                     |
| Comunicação | HTTP / JSON                   |
| Backend     | API REST (ASP.NET Core)       |

---

## 🔐 Segurança (ponto-chave do projeto)

✔️ Nenhuma credencial sensível versionada  
✔️ Nenhum token ou chave exposta no repositório  
✔️ Configurações sensíveis mantidas fora do código  
✔️ Arquivos de build, cache e dependências ignorados no Git  
✔️ Firebase (quando utilizado no app) configurado apenas localmente  

Este repositório foi revisado antes de se tornar público, garantindo que apenas código e decisões técnicas estejam expostos.

---

## ⚙️ Decisões de arquitetura

🔹 Base de código única para web e mobile  
🔹 Frontend responsável apenas pela camada de interface  
🔹 Regras de negócio concentradas exclusivamente no backend  
🔹 Consumo de API REST via HTTP/JSON  
🔹 Baixo acoplamento com o ambiente de execução (browser ou Android)  
🔹 Evolução do projeto sem bifurcação de código  

## 🗂️ Organização do projeto

* **src/app/** → Componentes, serviços e módulos Angular
* **src/environments/** → Configurações de ambiente
* **android/** → Projeto Android gerado via Capacitor
* **capacitor plugins/** → Integrações nativas quando necessário

A estrutura foi mantida simples e previsível, priorizando **manutenção**, **clareza** e **evolução contínua**.

---

## 🔁 Evolução do projeto

O frontend nasceu como uma **aplicação web pura**, executada como SPA no navegador.

Com a necessidade de uso em dispositivos móveis, o projeto foi adaptado para rodar como **aplicativo Android**, mantendo a mesma base de código.

A escolha do **Capacitor** permitiu empacotar a aplicação Angular como app nativo, sem reescrita de telas ou lógica, preservando consistência e reduzindo custo de manutenção.

---

## 📌 Por que este repositório é público

Este projeto foi tornado público **exclusivamente como portfólio técnico**.

* Produto comercial ❌
* Sistema aberto ao público ❌
* Dados reais ❌
* Credenciais ou segredos ❌

O foco do repositório é permitir a avaliação de **qualidade de código**, **arquitetura frontend** e **maturidade técnica** do desenvolvedor.

---

## 👤 Autor

**Johnny Frits**  
Senior .NET Backend / Full Stack Developer  

 🔹 Angular SPA  
 🔹 Integração com APIs REST  
 🔹 Aplicações Web e Mobile  
 🔹 Arquitetura limpa e pragmática  

---
