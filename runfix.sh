export PATH=$(echo $PATH | sed -s 's+/opt/splunk-dev/bin:++')
node -v
npm run start