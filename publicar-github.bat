@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Publicar Motocolatras no GitHub
cd /d "%~dp0"

echo ==============================================
echo   Publicar Motocolatras no GitHub
echo ==============================================
echo.

REM ---- 1. Git instalado? ----
where git >nul 2>&1
if errorlevel 1 goto :semgit

REM ---- 2. Repositorio local ----
if exist ".git" goto :temrepo
echo [1/5] Criando repositorio local...
git init >nul
git branch -M main >nul 2>&1
:temrepo

REM ---- 3. Nome/e-mail do autor ----
for /f "delims=" %%a in ('git config user.name 2^>nul') do set "GITNOME=%%a"
if defined GITNOME goto :temnome
set /p GITNOME="Seu nome para o Git: "
git config user.name "%GITNOME%"
:temnome
for /f "delims=" %%a in ('git config user.email 2^>nul') do set "GITEMAIL=%%a"
if defined GITEMAIL goto :tememail
set /p GITEMAIL="Seu e-mail do GitHub: "
git config user.email "%GITEMAIL%"
:tememail

REM ---- 4. Commit ----
echo [2/5] Preparando arquivos...
git add -A
git diff --cached --quiet
if not errorlevel 1 goto :semmudanca
set "MSG="
set /p MSG="Descricao da alteracao (Enter = Atualizacao): "
if not defined MSG set "MSG=Atualizacao %date% %time:~0,5%"
echo [3/5] Gravando versao...
git commit -m "%MSG%" >nul
if errorlevel 1 goto :erro
goto :remoto
:semmudanca
echo Nenhuma alteracao nova para gravar.

REM ---- 5. Repositorio no GitHub (origin) ----
:remoto
git branch -M main >nul 2>&1
git remote get-url origin >nul 2>&1
if not errorlevel 1 goto :enviar

echo.
echo [4/5] Este projeto ainda nao esta ligado a um repositorio no GitHub.
where gh >nul 2>&1
if errorlevel 1 goto :manual
gh auth status >nul 2>&1
if errorlevel 1 goto :manual
echo GitHub CLI encontrado. Criando repositorio privado "motocolatras"...
gh repo create motocolatras --private --source=. --remote=origin
if errorlevel 1 goto :manual
goto :enviar

:manual
echo.
echo 1. Abra https://github.com/new
echo 2. Nome: motocolatras  -  marque Private
echo 3. NAO marque README, .gitignore nem licenca
echo 4. Clique em Create repository e copie o endereco .git
echo    exemplo: https://github.com/SEU-USUARIO/motocolatras.git
echo.
start "" https://github.com/new
set "URL="
set /p URL="Cole aqui o endereco do repositorio: "
if not defined URL goto :erro
git remote add origin "%URL%"
if errorlevel 1 goto :erro

REM ---- 6. Envio ----
:enviar
echo.
echo [5/5] Enviando para o GitHub...
echo (se abrir uma janela de login do GitHub, entre com a mesma conta do financeiro)
git push -u origin main
if errorlevel 1 goto :erropush

echo.
echo ==============================================
echo   Publicado com sucesso!
for /f "delims=" %%a in ('git remote get-url origin') do echo   %%a
echo   Se o projeto ja estiver ligado na Vercel,
echo   o site sera atualizado em 1-2 minutos.
echo ==============================================
goto :fim

:semgit
echo O Git nao esta instalado neste computador.
echo Baixe em https://git-scm.com/download/win , instale e rode este arquivo de novo.
start "" https://git-scm.com/download/win
goto :fim

:erropush
echo.
echo Nao foi possivel enviar. Causas comuns:
echo  - Login do GitHub cancelado ou conta diferente
echo  - O repositorio no GitHub foi criado com README; crie de novo vazio
echo  - Endereco errado: veja com  git remote -v  e corrija com
echo    git remote set-url origin https://github.com/SEU-USUARIO/motocolatras.git
goto :fim

:erro
echo.
echo Ocorreu um erro. Verifique as mensagens acima.

:fim
echo.
pause
endlocal
