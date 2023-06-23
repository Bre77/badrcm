FROM splunk/splunk as splunk
FROM mcr.microsoft.com/devcontainers/javascript-node:14
USER node
COPY --from=splunk --chown=node /opt/splunk /opt/splunk
COPY --from=splunk --chown=node /opt/splunk-etc /opt/splunk/etc
RUN echo '\nOPTIMISTIC_ABOUT_FILE_LOCKING = 1' >> /opt/splunk/etc/splunk-launch.conf
RUN npx degit Bre77/splunk-dev /opt/splunk/etc/apps/000_dev && npx degit ChrisYounger/config_explorer /opt/splunk/etc/apps/config_explorer
VOLUME [ "/opt/splunk/etc", "/opt/splunk/var" ]
ENV SPLUNK_HOME=/opt/splunk
#RUN /opt/splunk/bin/splunk start --accept-license --answer-yes --no-prompt --seed-passwd devcontainer && /opt/splunk/bin/splunk stop
