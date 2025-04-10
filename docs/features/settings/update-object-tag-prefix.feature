Feature: Update Object Tag Prefix

Scenario: Successful Update
Given the prefix is "Prefix"
And the following files with respective object tags:
 | File Name     | Object Tag    |
 | File1  			 | Prefix/File1  |
 | File2         | Prefix/File2  |
When I update the prefix to "UpdatedPrefix"
Then I should see that the prefix is "UpdatedPrefix"
And the object tags should be:
 | File Name  | Object Tag           |
 | File1  		| UpdatedPrefix/File1  |
 | File2      | UpdatedPrefix/File2  |

Scenario: Invalid Object Tag Prefix
When I update the prefix to "Prefix!"
Then I should see an error
